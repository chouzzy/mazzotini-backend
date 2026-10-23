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
 * Banco fora do ar ou conexão perdida: não é recusa do cálculo. A execução para e é retomada depois.
 * Os erros do Prisma de dado (registro que não existe mais, por exemplo) contam como recusa.
 */
export function isInfrastructureError(e: any): boolean {
    const name = typeof e?.name === 'string' ? e.name : '';
    if (['PrismaClientInitializationError', 'PrismaClientRustPanicError', 'PrismaClientUnknownRequestError'].includes(name)) return true;
    if (name === 'PrismaClientKnownRequestError') return /^P1/.test(e.code ?? '') || ['P2024', 'P2034'].includes(e.code);
    return false;
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
            if (isInfrastructureError(e)) throw e;
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

    const { year, month, day, hour } = saoPauloDateParts(now);
    if (day < RECALCULATION_DAY || (day === RECALCULATION_DAY && hour < RECALCULATION_HOUR)) return null;

    const period = periodOf(year, month);
    const key    = { job_period: { job: JOB, period } };
    const run    = await prisma.jobRun.findUnique({ where: key });
    if (run?.status === 'DONE') return null;

    if (day > LAST_RESUME_DAY) {
        // Começou e não terminou: os processos que faltaram ficam com o valor anterior
        if (run && !run.notifiedAt) {
            await notifyAllAdmins({
                title:            'Recálculo mensal não terminou',
                message:          `O recálculo de ${formatPeriod(period)} começou e não terminou até o dia ${LAST_RESUME_DAY}. Os processos que faltaram continuam com o valor anterior até o próximo recálculo. Avise o suporte.`,
                type:             'warning',
                notificationType: 'CALCULATION',
                link:             '/processos',
            });
            await prisma.jobRun.update({ where: key, data: { notifiedAt: new Date() } });
        }
        return null;
    }

    // Sem registro, o mês pode ter sido recalculado antes desta retomada existir (o cron antigo não
    // gravava o andamento): com log do cron no mês, não recalcula de novo
    if (!run) {
        const legacyLogs = await prisma.calculationLog.count({
            where: { calculatedBy: 'cron', referenceYear: year, referenceMonth: month },
        });
        if (legacyLogs > 0) return null;
    }

    return runMonthlyRecalculation(now, runner);
}
