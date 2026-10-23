import { PrismaClient } from '@prisma/client';
import {
    isInfrastructureError, resumeMonthlyRecalculationIfPending, runMonthlyRecalculation,
} from './monthlyRecalculation';
import { isFirstInstance, updateIndexSeries } from './indexUpdateService';
import { notifyAllAdmins } from './notificationService';

jest.mock('@prisma/client', () => {
    const mPrisma: any = {
        jobRun:                   { upsert: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
        processCalculationParams: { findMany: jest.fn(), count: jest.fn() },
        calculationLog:           { findMany: jest.fn(), count: jest.fn() },
        creditAsset:              { findMany: jest.fn() },
        $runCommandRaw:           jest.fn(),
    };
    return { PrismaClient: jest.fn(() => mPrisma) };
});

jest.mock('./indexUpdateService', () => ({ isFirstInstance: jest.fn(), updateIndexSeries: jest.fn() }));
jest.mock('./notificationService', () => ({ notifyAllAdmins: jest.fn() }));
// O motor não roda aqui: o RunCalculationUseCase real só é criado como padrão
jest.mock('../modules/calculator/useCases/runCalculation/RunCalculationUseCase', () => ({ RunCalculationUseCase: jest.fn() }));

const prisma = new PrismaClient() as any;

// Três processos fictícios com parâmetros de cálculo
const params = ['asset-1', 'asset-2', 'asset-3'].map(assetId => ({ assetId }));
const runner = { calculateAndSave: jest.fn() };

/** Um horário de Brasília (UTC−3) em novembro de 2026. */
const at = (day: number, hour: number) => new Date(Date.UTC(2026, 10, day, hour + 3, 30));

const runKey = { job_period: { job: 'MONTHLY_RECALCULATION', period: '2026-11' } };
const finalUpdate = () => prisma.jobRun.update.mock.calls.find((c: any[]) => c[0].data.status === 'DONE')?.[0];

/** O erro que o Prisma 5 lança no MongoDB com o Atlas fora do ar. */
const atlasOffline = () => Object.assign(
    new Error('Raw query failed. Code: `unknown`. Message: `Kind: Server selection timeout: No available servers`'),
    { name: 'PrismaClientKnownRequestError', code: 'P2010' },
);

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    (isFirstInstance as jest.Mock).mockReturnValue(true);
    (notifyAllAdmins as jest.Mock).mockResolvedValue(true);
    prisma.processCalculationParams.findMany.mockResolvedValue(params);
    prisma.processCalculationParams.count.mockResolvedValue(params.length);
    prisma.calculationLog.findMany.mockResolvedValue([]);
    prisma.calculationLog.count.mockResolvedValue(0);
    prisma.creditAsset.findMany.mockResolvedValue([{ id: 'asset-2', legalOneId: 222, processNumber: '0000002-00.2020.8.26.0100' }]);
    prisma.jobRun.findUnique.mockResolvedValue(null);
    prisma.$runCommandRaw.mockResolvedValue({ ok: 1 });   // banco no ar
    runner.calculateAndSave.mockResolvedValue({ totalValue: 1000 });
});

describe('runMonthlyRecalculation', () => {
    it('marca o mês, atualiza os índices, recalcula todos e fecha o mês com o resumo', async () => {
        const summary = await runMonthlyRecalculation(at(5, 4), runner);

        expect(prisma.jobRun.upsert).toHaveBeenCalledWith({
            where: runKey, create: { job: 'MONTHLY_RECALCULATION', period: '2026-11', status: 'RUNNING' }, update: { status: 'RUNNING' },
        });
        expect(updateIndexSeries).toHaveBeenCalled();
        expect(runner.calculateAndSave).toHaveBeenCalledTimes(3);
        expect(runner.calculateAndSave).toHaveBeenCalledWith(params[0], 'cron', 2026, 11);
        expect(summary).toEqual({ period: '2026-11', recalculated: 3, skipped: 0, withWarnings: 0, failures: 0 });
        expect(finalUpdate().data).toMatchObject({ status: 'DONE', summary });
    });

    it('pula os processos que já têm o log do cron do mês (execução anterior interrompida)', async () => {
        prisma.calculationLog.findMany.mockResolvedValue([{ assetId: 'asset-1' }]);

        const summary = await runMonthlyRecalculation(at(5, 6), runner);

        expect(runner.calculateAndSave).toHaveBeenCalledTimes(2);
        expect(summary).toMatchObject({ recalculated: 2, skipped: 1 });
    });

    it('a recusa de um cálculo (banco no ar) vira aviso aos admins, e o mês fecha', async () => {
        runner.calculateAndSave.mockImplementation((p: any) => p.assetId === 'asset-2'
            ? Promise.reject(new Error('Falta IPCA de 01/2026 no banco de índices. Avise o suporte.'))
            : Promise.resolve({ totalValue: 1000, warnings: ['aviso'] }));

        const summary = await runMonthlyRecalculation(at(5, 4), runner);

        expect(summary).toMatchObject({ recalculated: 2, failures: 1, withWarnings: 2 });
        expect(notifyAllAdmins).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Recálculo mensal recusado', relatedEntityName: '0000002-00.2020.8.26.0100 (Legal One 222)',
        }));
        expect(finalUpdate()).toBeDefined();
    });

    it('Atlas fora do ar no meio (o P2010 do MongoDB, e o ping também falha): para sem fechar o mês, para ser retomado', async () => {
        runner.calculateAndSave.mockResolvedValueOnce({ totalValue: 1000 }).mockRejectedValue(atlasOffline());
        prisma.$runCommandRaw.mockRejectedValue(atlasOffline());

        await expect(runMonthlyRecalculation(at(5, 4), runner)).rejects.toThrow('Server selection timeout');
        expect(finalUpdate()).toBeUndefined();
        expect(notifyAllAdmins).not.toHaveBeenCalled();
    });

    it('erro sem formato do Prisma (ex.: embrulhado) com o banco sem responder ao ping: também para', async () => {
        prisma.$runCommandRaw.mockRejectedValue(atlasOffline());
        runner.calculateAndSave.mockRejectedValueOnce(new Error('Contrato 2: falha inesperada'));

        await expect(runMonthlyRecalculation(at(5, 4), runner)).rejects.toThrow('Contrato 2: falha inesperada');
        expect(finalUpdate()).toBeUndefined();
    });

    it('queda breve do banco num processo (o ping responde): a segunda tentativa recalcula o processo', async () => {
        let failedOnce = false;
        runner.calculateAndSave.mockImplementation((p: any) => {
            if (p.assetId === 'asset-2' && !failedOnce) { failedOnce = true; return Promise.reject(atlasOffline()); }
            return Promise.resolve({ totalValue: 1000 });
        });

        const summary = await runMonthlyRecalculation(at(5, 4), runner);

        expect(summary).toMatchObject({ recalculated: 3, failures: 0 });
        expect(runner.calculateAndSave).toHaveBeenCalledTimes(4);
    });

    it('erro do banco que se repete só num processo (o ping responde): vira aviso, e os outros seguem', async () => {
        runner.calculateAndSave.mockImplementation((p: any) => p.assetId === 'asset-2'
            ? Promise.reject(atlasOffline())
            : Promise.resolve({ totalValue: 1000 }));

        const summary = await runMonthlyRecalculation(at(5, 4), runner);

        // Duas tentativas no asset-2; o asset-3, depois dele, também é recalculado
        expect(runner.calculateAndSave).toHaveBeenCalledTimes(4);
        expect(runner.calculateAndSave).toHaveBeenLastCalledWith(params[2], 'cron', 2026, 11);
        expect(summary).toMatchObject({ recalculated: 2, failures: 1 });
        // O aviso leva só o código do erro do banco; o texto técnico (com os servidores) fica no log
        expect(notifyAllAdmins).toHaveBeenCalledWith(expect.objectContaining({
            title:   'Recálculo mensal recusado',
            message: 'Processo 0000002-00.2020.8.26.0100 (Legal One 222): Erro do banco de dados (P2010) ao recalcular; o detalhe ficou no log do servidor. O valor atualizado continua o anterior.',
        }));
        expect(finalUpdate()).toBeDefined();
    });

    it('com o PM2 em cluster, só a primeira instância recalcula', async () => {
        (isFirstInstance as jest.Mock).mockReturnValue(false);

        await expect(runMonthlyRecalculation(at(5, 4), runner)).resolves.toBeNull();
        expect(prisma.jobRun.upsert).not.toHaveBeenCalled();
    });
});

describe('resumeMonthlyRecalculationIfPending', () => {
    it.each([
        ['antes do dia 5', at(4, 23)],
        ['no dia 5 antes das 4h', at(5, 3)],
    ])('não faz nada %s', async (_, now) => {
        await expect(resumeMonthlyRecalculationIfPending(now, runner)).resolves.toBeNull();
        expect(prisma.jobRun.findUnique).not.toHaveBeenCalled();
    });

    it('o horário das 4h foi pulado: no dia 5, depois das 4h, roda o mês', async () => {
        const summary = await resumeMonthlyRecalculationIfPending(at(5, 5), runner);

        expect(summary).toMatchObject({ period: '2026-11', recalculated: 3 });
    });

    it('execução interrompida (RUNNING): retoma até o dia 10', async () => {
        prisma.jobRun.findUnique.mockResolvedValue({ status: 'RUNNING' });

        await expect(resumeMonthlyRecalculationIfPending(at(10, 23), runner)).resolves.toMatchObject({ recalculated: 3 });
    });

    it('com a execução do mês ainda rodando nesta instância, não começa outra nem avisa', async () => {
        let finish: (v: unknown) => void = () => {};
        runner.calculateAndSave.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        const first = runMonthlyRecalculation(at(10, 23), runner);
        await new Promise(resolve => setImmediate(resolve));

        // Já é dia 11, e o mês ainda não fechou: a execução em andamento não vira aviso
        await expect(resumeMonthlyRecalculationIfPending(at(11, 0), runner)).resolves.toBeNull();
        expect(prisma.jobRun.findUnique).not.toHaveBeenCalled();
        expect(notifyAllAdmins).not.toHaveBeenCalled();

        finish({ totalValue: 1000 });
        await first;
    });

    it('mês já fechado: não recalcula de novo', async () => {
        prisma.jobRun.findUnique.mockResolvedValue({ status: 'DONE' });

        await expect(resumeMonthlyRecalculationIfPending(at(6, 10), runner)).resolves.toBeNull();
        expect(runner.calculateAndSave).not.toHaveBeenCalled();
    });

    it('mês sem registro e com log do cron antigo (que pode ter parado no meio): retoma, pulando os que já têm log', async () => {
        prisma.calculationLog.findMany.mockResolvedValue([{ assetId: 'asset-1' }, { assetId: 'asset-2' }]);

        await expect(resumeMonthlyRecalculationIfPending(at(7, 10), runner)).resolves.toMatchObject({ recalculated: 1, skipped: 2 });
    });

    it('depois do dia 10, um mês que não terminou vira aviso aos admins, uma vez', async () => {
        prisma.jobRun.findUnique.mockResolvedValue({ status: 'RUNNING', notifiedAt: null });

        await expect(resumeMonthlyRecalculationIfPending(at(11, 10), runner)).resolves.toBeNull();
        expect(runner.calculateAndSave).not.toHaveBeenCalled();
        expect(notifyAllAdmins).toHaveBeenCalledWith(expect.objectContaining({ title: 'Recálculo mensal não terminou' }));
        expect(prisma.jobRun.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: runKey, update: { notifiedAt: expect.any(Date) } }));

        jest.clearAllMocks();
        prisma.jobRun.findUnique.mockResolvedValue({ status: 'RUNNING', notifiedAt: new Date() });
        await resumeMonthlyRecalculationIfPending(at(11, 11), runner);
        expect(notifyAllAdmins).not.toHaveBeenCalled();
    });

    it('depois do dia 10, mês que nem rodou (sem registro e sem log do cron): avisa, uma vez', async () => {
        await expect(resumeMonthlyRecalculationIfPending(at(12, 10), runner)).resolves.toBeNull();

        expect(notifyAllAdmins).toHaveBeenCalledWith(expect.objectContaining({ title: 'Recálculo mensal não rodou' }));
        expect(prisma.jobRun.upsert).toHaveBeenCalledWith(expect.objectContaining({
            create: { job: 'MONTHLY_RECALCULATION', period: '2026-11', status: 'MISSED', notifiedAt: expect.any(Date) },
        }));
    });

    it('depois do dia 10, sem registro e sem nenhum processo com cálculo: não havia o que recalcular, e não avisa', async () => {
        prisma.processCalculationParams.count.mockResolvedValue(0);

        await expect(resumeMonthlyRecalculationIfPending(at(12, 10), runner)).resolves.toBeNull();
        expect(notifyAllAdmins).not.toHaveBeenCalled();
        expect(prisma.jobRun.upsert).not.toHaveBeenCalled();
    });

    it('depois do dia 10, mês do cron antigo (sem registro, com log): nem recalcula nem avisa', async () => {
        prisma.calculationLog.count.mockResolvedValue(12);

        await expect(resumeMonthlyRecalculationIfPending(at(24, 10), runner)).resolves.toBeNull();
        expect(prisma.jobRun.upsert).not.toHaveBeenCalled();
        expect(notifyAllAdmins).not.toHaveBeenCalled();
    });

    it('se o aviso não foi gravado, não marca o mês como avisado (tenta de novo na próxima hora)', async () => {
        prisma.jobRun.findUnique.mockResolvedValue({ status: 'RUNNING', notifiedAt: null });
        (notifyAllAdmins as jest.Mock).mockResolvedValue(false);

        await resumeMonthlyRecalculationIfPending(at(11, 10), runner);

        expect(prisma.jobRun.upsert).not.toHaveBeenCalled();
    });
});

describe('isInfrastructureError', () => {
    it.each([
        ['banco que não respondeu', { name: 'PrismaClientUnknownRequestError' }, true],
        ['conexão recusada', { name: 'PrismaClientKnownRequestError', code: 'P1001' }, true],
        ['Atlas fora do ar no MongoDB (P2010)', { name: 'PrismaClientKnownRequestError', code: 'P2010' }, true],
        ['tempo esgotado no pool', { name: 'PrismaClientKnownRequestError', code: 'P2024' }, true],
        ['registro que não existe mais', { name: 'PrismaClientKnownRequestError', code: 'P2025' }, false],
        ['recusa do cálculo', new Error('Falta IPCA de 01/2026 no banco de índices.'), false],
    ])('%s', (_, error, expected) => {
        expect(isInfrastructureError(error)).toBe(expected);
    });
});
