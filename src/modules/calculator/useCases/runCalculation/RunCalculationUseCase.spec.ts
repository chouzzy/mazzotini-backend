import { PrismaClient } from '@prisma/client';
import { RunCalculationUseCase, toCalculationParams } from './RunCalculationUseCase';
import { calculateJudicialDebt } from '../../../../services/judicialCalculatorService';

jest.mock('@prisma/client', () => {
    const mPrisma: any = {
        creditAsset: { findUnique: jest.fn(), update: jest.fn() },
        processCalculationParams: { findUnique: jest.fn(), update: jest.fn() },
        calculationLog: { create: jest.fn() },
    };
    return { PrismaClient: jest.fn(() => mPrisma) };
});

jest.mock('../../../../services/judicialCalculatorService', () => ({
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
