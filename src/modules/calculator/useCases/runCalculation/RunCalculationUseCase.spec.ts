import { PrismaClient } from '@prisma/client';
import { RunCalculationUseCase, toCalculationParams, toExtraCalculations } from './RunCalculationUseCase';
import { calculateJudicialDebt } from '../../../../services/judicialCalculatorService';

jest.mock('@prisma/client', () => {
    const mPrisma: any = {
        creditAsset: { findUnique: jest.fn(), update: jest.fn() },
        processCalculationParams: { findUnique: jest.fn(), update: jest.fn() },
        calculationLog: { create: jest.fn() },
    };
    // Forma de lista: as operações já vêm montadas e são executadas juntas
    mPrisma.$transaction = jest.fn((operations: unknown[]) => Promise.all(operations));
    return { PrismaClient: jest.fn(() => mPrisma) };
});

jest.mock('../../../../services/judicialCalculatorService', () => ({
    ...jest.requireActual('../../../../services/judicialCalculatorService'),
    calculateJudicialDebt: jest.fn(),
}));

const prisma = new PrismaClient() as any;

/** Parâmetros salvos de um processo fictício, com os campos que o cron do dia 5 ignorava. */
const savedParams: any = {
    id: 'params-1',
    assetId: 'asset-1',
    correctionIndex: 'IPCA_E',
    moratoryMode: 'PERSONALIZADO',
    moratoryRate: 12,
    moratoryRateUnit: 'AA',
    moratoryType: 'COMPOSTO',
    moratoryStartDate: new Date('2024-03-01T00:00:00.000Z'),
    compensatoryRate: 6,
    compensatoryRateUnit: 'AA',
    compensatoryType: 'SIMPLES',
    compensatoryStartDate: new Date('2024-06-01T00:00:00.000Z'),
    multaPercentage: 2,
    feesMode: 'FIXO',
    feesFixedValue: 1500,
    feesPercentage: 10,
    penaltyPercentage: 10,
    feesOnPenalty: true,
    feesOnMulta: true,
    deflate: true,
    installments: [{ baseValue: 1000, baseDate: '2024-01-15T00:00:00.000Z', description: 'Parcela exemplo' }],
    lastCalculatedValue: null,
    lastCalculatedAt: null,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
};

const fakeResult = {
    baseTotal: 1000,
    correctedValue: 1100,
    moratoryInterest: 50,
    compensatoryInterest: 20,
    feesValue: 1500,
    penaltyValue: 100,
    totalValue: 2770,
    installmentResults: [],
};

describe('toCalculationParams', () => {
    it('leva para o motor juros personalizados, unidades das taxas, multa, honorário fixo e início dos compensatórios', () => {
        expect(toCalculationParams(savedParams)).toEqual({
            correctionIndex: 'IPCA_E',
            moratoryMode: 'PERSONALIZADO',
            moratoryRate: 12,
            moratoryRateUnit: 'AA',
            moratoryType: 'COMPOSTO',
            moratoryStartDate: '2024-03-01T00:00:00.000Z',
            compensatoryRate: 6,
            compensatoryRateUnit: 'AA',
            compensatoryType: 'SIMPLES',
            compensatoryStartDate: '2024-06-01T00:00:00.000Z',
            multaPercentage: 2,
            feesMode: 'FIXO',
            feesPercentage: 10,
            feesFixedValue: 1500,
            penaltyPercentage: 10,
            feesOnPenalty: true,
            feesOnMulta: true,
            deflate: true,
            installments: savedParams.installments,
        });
    });

    it('usa os padrões quando o registro não tem os campos mais novos', () => {
        const oldRecord = {
            ...savedParams,
            moratoryMode: undefined,
            moratoryRateUnit: undefined,
            moratoryStartDate: null,
            compensatoryRateUnit: undefined,
            compensatoryStartDate: undefined,
            multaPercentage: undefined,
            feesMode: undefined,
            feesFixedValue: undefined,
            // Salvos antes das opções do Dr. Calc: o Mongo devolve null
            feesOnMulta: null,
            deflate: null,
        };

        expect(toCalculationParams(oldRecord)).toMatchObject({
            moratoryMode: 'TAXA_LEGAL',
            moratoryRateUnit: 'AM',
            moratoryStartDate: null,
            compensatoryRateUnit: 'AM',
            compensatoryStartDate: null,
            multaPercentage: 0,
            feesMode: 'PERCENTUAL',
            feesFixedValue: 0,
            feesOnMulta: false,
            deflate: false,
        });
    });
});

describe('RunCalculationUseCase', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (calculateJudicialDebt as jest.Mock).mockResolvedValue(fakeResult);
        prisma.creditAsset.findUnique.mockResolvedValue({ id: 'asset-1', legalOneId: 123 });
        prisma.processCalculationParams.findUnique.mockResolvedValue(savedParams);
    });

    it('recálculo automático (cron) calcula com os parâmetros completos e grava o snapshot', async () => {
        const result = await new RunCalculationUseCase().calculateAndSave(savedParams, 'cron', 2026, 11);

        expect(result).toBe(fakeResult);
        expect(calculateJudicialDebt).toHaveBeenCalledWith(toCalculationParams(savedParams), 2026, 11);

        const log = prisma.calculationLog.create.mock.calls[0][0].data;
        expect(log).toMatchObject({ assetId: 'asset-1', calculatedBy: 'cron', referenceYear: 2026, referenceMonth: 11, totalValue: 2770 });
        expect(log.paramsSnapshot).toEqual(toCalculationParams(savedParams));

        expect(prisma.processCalculationParams.update).toHaveBeenCalledWith({
            where: { assetId: 'asset-1' },
            data: { lastCalculatedValue: 2770, lastCalculatedAt: expect.any(Date) },
        });
        expect(prisma.creditAsset.update).toHaveBeenCalledWith({ where: { id: 'asset-1' }, data: { currentValue: 2770 } });
    });

    it('calculate só calcula, sem gravar nada (é o que a simulação do recálculo usa)', async () => {
        const { result, paramsSnapshot } = await new RunCalculationUseCase().calculate(savedParams, 2026, 11);

        expect(result).toBe(fakeResult);
        expect(paramsSnapshot).toEqual(toCalculationParams(savedParams));
        expect(prisma.calculationLog.create).not.toHaveBeenCalled();
        expect(prisma.processCalculationParams.update).not.toHaveBeenCalled();
        expect(prisma.creditAsset.update).not.toHaveBeenCalled();
    });

    it('botão "Calcular" passa pelo mesmo caminho, registrando quem calculou', async () => {
        await new RunCalculationUseCase().execute({ legalOneId: 123, auth0UserId: 'auth0|admin-exemplo', referenceYear: 2026, referenceMonth: 11 });

        expect(calculateJudicialDebt).toHaveBeenCalledWith(toCalculationParams(savedParams), 2026, 11);
        expect(prisma.calculationLog.create.mock.calls[0][0].data.calculatedBy).toBe('auth0|admin-exemplo');
        expect(prisma.creditAsset.update).toHaveBeenCalledWith({ where: { id: 'asset-1' }, data: { currentValue: 2770 } });
    });

    it('falha sem gravar nada quando o processo não tem parâmetros', async () => {
        prisma.processCalculationParams.findUnique.mockResolvedValue(null);

        await expect(new RunCalculationUseCase().execute({ legalOneId: 123, auth0UserId: 'auth0|admin-exemplo' }))
            .rejects.toThrow('Parâmetros de cálculo não configurados para este processo.');
        expect(prisma.calculationLog.create).not.toHaveBeenCalled();
        expect(prisma.creditAsset.update).not.toHaveBeenCalled();
    });
});

describe('RunCalculationUseCase com vários cálculos no mesmo processo', () => {
    /** Resultado fictício completo de um cálculo, com uma parcela. */
    const resultOf = (total: number, description: string) => ({
        referenceMonth: 11, referenceYear: 2026,
        baseTotal: total, correctedValue: total, moratoryInterest: 0, compensatoryInterest: 0,
        multaValue: 0, subtotalA: total, feesValue: 0, subtotalB: total, penaltyValue: 0, grossTotal: total,
        abatimentoResults: [], abatimentoTotal: 0, custaResults: [], custaTotal: 0, totalValue: total,
        installmentResults: [{ installmentIndex: 1, description, baseValue: total }],
    });

    const twoContracts = {
        ...savedParams,
        calculationLabel: 'Contrato 1',
        extraCalculations: [{
            label: 'Contrato 2',
            correctionIndex: 'TJSP_LEI14905',
            moratoryMode: 'PERSONALIZADO', moratoryRate: 1, moratoryRateUnit: 'AM', moratoryType: 'SIMPLES',
            moratoryStartDate: '2025-11-15T00:00:00.000Z',
            compensatoryRate: 6, compensatoryRateUnit: 'AA', compensatoryType: 'SIMPLES',
            compensatoryStartDate: '2025-11-15T00:00:00.000Z',
            multaPercentage: 0, feesMode: 'PERCENTUAL', feesPercentage: 10, feesFixedValue: 0,
            penaltyPercentage: 0, feesOnPenalty: false,
            installments: [{ baseValue: 500, baseDate: '2025-11-15T00:00:00.000Z', description: 'Parcela B' }],
        }],
    };

    beforeEach(() => jest.clearAllMocks());

    it('toExtraCalculations lê os cálculos extras com os padrões do primeiro', () => {
        const [extra] = toExtraCalculations({ ...savedParams, extraCalculations: [{ correctionIndex: 'IPCA', installments: [] }] });

        expect(extra.label).toBe('Cálculo 2');
        expect(extra.params).toMatchObject({
            correctionIndex: 'IPCA', moratoryMode: 'TAXA_LEGAL', moratoryRate: 1, moratoryRateUnit: 'AM', feesMode: 'PERCENTUAL',
            feesOnPenalty: false, feesOnMulta: false, deflate: false,
        });
        expect(toExtraCalculations(savedParams)).toEqual([]);
    });

    it('calcula cada cálculo, grava a soma e guarda todos no snapshot', async () => {
        (calculateJudicialDebt as jest.Mock)
            .mockResolvedValueOnce(resultOf(1000, 'Parcela exemplo'))
            .mockResolvedValueOnce(resultOf(500, 'Parcela B'));

        const result = await new RunCalculationUseCase().calculateAndSave(twoContracts, 'cron', 2026, 11);

        expect(calculateJudicialDebt).toHaveBeenCalledTimes(2);
        expect((calculateJudicialDebt as jest.Mock).mock.calls[1][0]).toMatchObject({ compensatoryRate: 6, compensatoryRateUnit: 'AA' });
        expect(result.totalValue).toBe(1500);
        expect(result.installmentResults.map(i => i.description)).toEqual(['Contrato 1 · Parcela exemplo', 'Contrato 2 · Parcela B']);

        const log = prisma.calculationLog.create.mock.calls[0][0].data;
        expect(log.totalValue).toBe(1500);
        expect(log.paramsSnapshot).toMatchObject({ calculationLabel: 'Contrato 1', extraCalculations: [{ label: 'Contrato 2' }] });
        expect(prisma.creditAsset.update).toHaveBeenCalledWith({ where: { id: 'asset-1' }, data: { currentValue: 1500 } });
    });

    it('um erro num dos cálculos diz qual foi e não grava nada', async () => {
        (calculateJudicialDebt as jest.Mock)
            .mockResolvedValueOnce(resultOf(1000, 'Parcela exemplo'))
            .mockRejectedValueOnce(new Error('Nenhuma parcela informada.'));

        await expect(new RunCalculationUseCase().calculateAndSave(twoContracts, 'cron', 2026, 11))
            .rejects.toThrow('Contrato 2: Nenhuma parcela informada.');
        expect(prisma.calculationLog.create).not.toHaveBeenCalled();
        expect(prisma.creditAsset.update).not.toHaveBeenCalled();
    });
});

describe('RunCalculationUseCase: revisão de 23/10', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (calculateJudicialDebt as jest.Mock).mockResolvedValue(fakeResult);
        prisma.creditAsset.findUnique.mockResolvedValue({ id: 'asset-1', legalOneId: 123 });
        prisma.processCalculationParams.findUnique.mockResolvedValue(savedParams);
    });

    it('grava o log, os parâmetros e o valor atual numa transação só', async () => {
        await new RunCalculationUseCase().calculateAndSave(savedParams, 'cron', 2026, 11);

        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        expect(prisma.$transaction.mock.calls[0][0]).toHaveLength(3);
    });

    it('parâmetro gravado com valor desconhecido é recusado antes do motor, sem gravar nada', async () => {
        await expect(new RunCalculationUseCase().calculateAndSave({ ...savedParams, moratoryType: 'COMPOSTOS' }, 'cron', 2026, 11))
            .rejects.toThrow('Tipo dos juros moratórios: valor inválido (COMPOSTOS).');
        expect(calculateJudicialDebt).not.toHaveBeenCalled();
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('num cálculo extra, a recusa diz qual cálculo', async () => {
        const params = {
            ...savedParams,
            extraCalculations: [{
                label: 'Contrato 2', correctionIndex: 'IPCA', multaPercentage: -5,
                installments: [{ baseValue: 500, baseDate: '2025-11-15T00:00:00.000Z' }],
            }],
        };

        await expect(new RunCalculationUseCase().calculateAndSave(params, 'cron', 2026, 11))
            .rejects.toThrow('Contrato 2: multa: o valor não pode ser negativo.');
        // Todos são validados antes de calcular: o cálculo 1 nem roda
        expect(calculateJudicialDebt).not.toHaveBeenCalled();
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('sem o mês na tela, vale o mês de Brasília, e não o do relógio do servidor', async () => {
        jest.useFakeTimers({ now: new Date('2026-11-01T01:00:00.000Z') });   // 22h de 31/10 em Brasília
        try {
            await new RunCalculationUseCase().execute({ legalOneId: 123, auth0UserId: 'auth0|admin-exemplo' });

            expect(calculateJudicialDebt).toHaveBeenCalledWith(expect.anything(), 2026, 10);
        } finally {
            jest.useRealTimers();
        }
    });
});

describe('RunCalculationUseCase: erro do banco num cálculo extra', () => {
    beforeEach(() => jest.clearAllMocks());

    it('sobe como está (sem o nome do cálculo), para o recálculo mensal reconhecer o banco fora do ar', async () => {
        const offline = Object.assign(new Error('Raw query failed. Server selection timeout'), { name: 'PrismaClientKnownRequestError', code: 'P2010' });
        (calculateJudicialDebt as jest.Mock).mockResolvedValueOnce(fakeResult).mockRejectedValueOnce(offline);
        const params = {
            ...savedParams,
            extraCalculations: [{ label: 'Contrato 2', correctionIndex: 'IPCA', installments: [{ baseValue: 500, baseDate: '2025-11-15T00:00:00.000Z' }] }],
        };

        await expect(new RunCalculationUseCase().calculate(params, 2026, 11)).rejects.toBe(offline);
    });
});
