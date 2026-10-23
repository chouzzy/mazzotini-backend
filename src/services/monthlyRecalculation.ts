/**
 * Recálculo mensal (dia 5, às 4h): atualiza os índices e recalcula todos os processos com
 * parâmetros de cálculo, pelo mesmo caminho do botão "Calcular". O valor atual que o cliente vê sai
 * daqui.
 *
 * O node-cron pula um horário perdido (servidor ocupado ou reiniciando às 4h), e um Atlas fora do ar
 * ou um reinício no meio deixavam o mês sem recálculo, ou pela metade, sem aviso. Por isso o
 * andamento fica gravado em JobRun (job MONTHLY_RECALCULATION, um registro por mês de referência):
 * - a execução marca RUNNING ao começar e DONE ao terminar;
 * - no início do servidor e de hora em hora (aos :15), um mês que não terminou é retomado, do dia 5
 *   às 4h até o dia 10, pulando os processos que já têm o log do cron daquele mês;
 * - o banco fora do ar no meio interrompe a execução (para ser retomada); a recusa de um cálculo
 *   não, e vira aviso aos admins, como antes;
 * - passado o dia 10 sem terminar, os admins recebem um aviso, uma vez.
 * Com o PM2 em cluster, só a primeira instância recalcula.
 */

import { prisma } from '../prisma';
import { RunCalculationUseCase } from '../modules/calculator/useCases/runCalculation/RunCalculationUseCase';
import { isFirstInstance, updateIndexSeries } from './indexUpdateService';
import { notifyAllAdmins } from './notificationService';
import { describeAsset, notifyRecalculationFailures, RecalculationFailure } from './recalculationReport';
import { saoPauloDateParts } from '../utils/saoPauloDate';

const JOB = 'MONTHLY_RECALCULATION';

/** Dia e hora do recálculo (Brasília) e o último dia em que ele ainda é retomado sozinho. */
export const RECALCULATION_DAY  = 5;
export const RECALCULATION_HOUR = 4;
export const LAST_RESUME_DAY    = 10;

export interface MonthlyRecalculationSummary {
    period:       string;   // mês de referência, "AAAA-MM"
    recalculated: number;
    skipped:      number;   // já recalculados numa execução anterior do mesmo mês
    withWarnings: number;
    failures:     number;   // recusados: ficam com o valor anterior
}

const periodOf     = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;
const formatPeriod = (period: string) => period.split('-').reverse().join('/');

/** Linha do log com o resultado do recálculo. */
export function describeRecalculation(s: MonthlyRecalculationSummary): string {
    return `Recálculo de ${formatPeriod(s.period)}: ${s.recalculated} recalculados, ${s.skipped} já feitos antes, `
        + `${s.failures} recusados, ${s.withWarnings} com avisos (como um mês ainda sem índice no banco, contado como 0%)`;
}

/**
 * Erro que já se sabe ser do banco fora do ar ou da conexão perdida: não é recusa do cálculo, e a
 * execução para para ser retomada depois. No MongoDB, o "Server selection timeout" chega como P2010.
 * Os erros do Prisma de dado (registro que não existe mais, por exemplo) contam como recusa.
 */
export function isInfrastructureError(e: any): boolean {
    const name = typeof e?.name === 'string' ? e.name : '';
    if (['PrismaClientInitializationError', 'PrismaClientRustPanicError', 'PrismaClientUnknownRequestError'].includes(name)) return true;
    if (name === 'PrismaClientKnownRequestError') return /^P1/.test(e.code ?? '') || ['P2010', 'P2024', 'P2034'].includes(e.code);
    return false;
}

/**
 * O banco responde? O formato do erro do Prisma muda com o conector e a versão, então, depois de um
 * erro que não se reconhece, quem decide entre "banco fora do ar" e "recusa do cálculo" é um ping.
 */
async function databaseIsUp(): Promise<boolean> {
    try {
        await prisma.$runCommandRaw({ ping: 1 });
        return true;
    } catch {
        return false;
    }
}

let running: Promise<MonthlyRecalculationSummary | null> | null = null;

/** O recálculo do mês atual (de Brasília). Chamadas ao mesmo tempo compartilham a mesma execução. */
export function runMonthlyRecalculation(
    now = new Date(),
    runner: Pick<RunCalculationUseCase, 'calculateAndSave'> = new RunCalculationUseCase(),
): Promise<MonthlyRecalculationSummary | null> {
    if (!isFirstInstance()) return Promise.resolve(null);
    if (!running) running = recalculate(now, runner).finally(() => { running = null; });
    return running;
}

async function recalculate(now: Date, runner: Pick<RunCalculationUseCase, 'calculateAndSave'>): Promise<MonthlyRecalculationSummary> {
    const { year, month } = saoPauloDateParts(now);
    const period = periodOf(year, month);
    const key    = { job_period: { job: JOB, period } };

    await prisma.jobRun.upsert({
        where:  key,
        create: { job: JOB, period, status: 'RUNNING' },
        update: { status: 'RUNNING' },
    });

    // 1. Busca os meses publicados desde o último gravado de cada índice
    await updateIndexSeries(now);

    // 2. Recalcula os processos com parâmetros, menos os que já têm o log do cron deste mês (de
    //    uma execução anterior que foi interrompida)
    const allParams = await prisma.processCalculationParams.findMany();
    const doneLogs  = await prisma.calculationLog.findMany({
        where:  { calculatedBy: 'cron', referenceYear: year, referenceMonth: month },
        select: { assetId: true },
    });
    const done = new Set(doneLogs.map(l => l.assetId));
    // Número do processo e do Legal One, para o log e o aviso dos recusados
    const assets = await prisma.creditAsset.findMany({
        where:  { id: { in: allParams.map(p => p.assetId) } },
        select: { id: true, legalOneId: true, processNumber: true },
    });
    const assetOf = new Map(assets.map(a => [a.id, a]));

    let recalculated = 0, skipped = 0, withWarnings = 0;
    const failures: RecalculationFailure[] = [];
    for (const params of allParams) {
        if (done.has(params.assetId)) { skipped++; continue; }
        try {
            const result = await runner.calculateAndSave(params, 'cron', year, month);
            if (result.warnings?.length) withWarnings++;
            recalculated++;
        } catch (e: any) {
            // Banco fora do ar: para aqui, sem fechar o mês, e a retomada continua deste processo
            if (isInfrastructureError(e) || !(await databaseIsUp())) throw e;
            const asset   = assetOf.get(params.assetId);
            const failure = { assetId: params.assetId, legalOneId: asset?.legalOneId, processNumber: asset?.processNumber, error: e.message };
            console.error(`  Erro ao recalcular o processo ${describeAsset(failure)}:`, e.message);
            failures.push(failure);
        }
    }

    // Um processo recusado mantém o valor anterior: os admins precisam saber quais são
    await notifyRecalculationFailures(failures);

    const summary: MonthlyRecalculationSummary = { period, recalculated, skipped, withWarnings, failures: failures.length };
    await prisma.jobRun.update({
        where: key,
        data:  { status: 'DONE', finishedAt: new Date(), summary: summary as any },
    });
    return summary;
}

/**
 * No início do servidor e de hora em hora: retoma o recálculo do mês se ele já devia ter rodado e
 * não terminou. Depois do último dia de retomada, avisa os admins uma vez.
 */
export async function resumeMonthlyRecalculationIfPending(
    now = new Date(),
    runner?: Pick<RunCalculationUseCase, 'calculateAndSave'>,
): Promise<MonthlyRecalculationSummary | null> {
    if (!isFirstInstance()) return null;
    // A execução do mês já está rodando nesta instância (a das 4h ou outra retomada): ela registra o
    // próprio resumo, e o mês ainda não terminou de verdade (não é caso de aviso)
    if (running) return null;

    const { year, month, day, hour } = saoPauloDateParts(now);
    if (day < RECALCULATION_DAY || (day === RECALCULATION_DAY && hour < RECALCULATION_HOUR)) return null;

    const period = periodOf(year, month);
    const key    = { job_period: { job: JOB, period } };
    const run    = await prisma.jobRun.findUnique({ where: key });
    if (run?.status === 'DONE' || run?.notifiedAt) return null;

    if (day > LAST_RESUME_DAY) {
        await noticeUnfinishedMonth(period, year, month, run !== null);
        return null;
    }

    // Retoma também um mês sem registro e com log do cron: o cron antigo, de antes desta retomada,
    // pode ter parado no meio. A execução pula os processos que já têm o log do mês
    return runMonthlyRecalculation(now, runner);
}

/**
 * Depois do último dia de retomada: avisa os admins, uma vez, do mês que começou e não terminou ou
 * que nem rodou (servidor ou banco fora do ar a janela toda). O registro só é marcado se o aviso saiu.
 */
async function noticeUnfinishedMonth(period: string, year: number, month: number, started: boolean): Promise<void> {
    if (!started) {
        // Sem registro e com log do cron no mês: é um mês do cron antigo, que não gravava o andamento
        const legacyLogs = await prisma.calculationLog.count({
            where: { calculatedBy: 'cron', referenceYear: year, referenceMonth: month },
        });
        if (legacyLogs > 0) return;
    }

    const sent = await notifyAllAdmins({
        title:            started ? 'Recálculo mensal não terminou' : 'Recálculo mensal não rodou',
        message:          started
            ? `O recálculo de ${formatPeriod(period)} começou e não terminou até o dia ${LAST_RESUME_DAY}. Os processos que faltaram continuam com o valor anterior até o próximo recálculo. Avise o suporte.`
            : `O recálculo de ${formatPeriod(period)} não rodou do dia ${RECALCULATION_DAY} ao dia ${LAST_RESUME_DAY} (servidor ou banco fora do ar). Os valores atualizados continuam os do mês anterior até o próximo recálculo. Avise o suporte.`,
        type:             'warning',
        notificationType: 'CALCULATION',
        link:             '/processos',
    });
    if (!sent) return;
    await prisma.jobRun.upsert({
        where:  { job_period: { job: JOB, period } },
        create: { job: JOB, period, status: 'MISSED', notifiedAt: new Date() },
        update: { notifiedAt: new Date() },
    });
}
