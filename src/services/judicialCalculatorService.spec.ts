import { PrismaClient } from '@prisma/client';
import { calculateJudicialDebt, CalculationParams, NAO_ATUALIZAR } from './judicialCalculatorService';

jest.mock('@prisma/client', () => {
    const mPrisma: any = { indexSeries: { findMany: jest.fn() } };
    return { PrismaClient: jest.fn(() => mPrisma) };
});

const prisma = new PrismaClient() as any;

/** Débito fictício de R$ 1.000 (jan/2026), juros de 1% a.m. simples, multa de 2% e honorários de 10%. */
const params: CalculationParams = {
    correctionIndex:       NAO_ATUALIZAR,
    moratoryMode:          'PERSONALIZADO',
    moratoryRate:          1,
    moratoryRateUnit:      'AM',
    moratoryType:          'SIMPLES',
    moratoryStartDate:     null,
    compensatoryRate:      0,
    compensatoryRateUnit:  'AM',
    compensatoryType:      'SIMPLES',
    compensatoryStartDate: null,
    multaPercentage:       2,
    feesMode:              'PERCENTUAL',
    feesPercentage:        10,
    feesFixedValue:        0,
    penaltyPercentage:     0,
    feesOnPenalty:         false,
    installments:          [{ baseValue: 1000, baseDate: '2026-01-15T00:00:00.000Z', description: 'Parcela exemplo' }],
};

describe('calculateJudicialDebt', () => {
    beforeEach(() => jest.clearAllMocks());

    it('"Não atualizar (fixo)" não corrige o principal e mantém juros, multa e honorários', async () => {
        const result = await calculateJudicialDebt(params, 2026, 7);

        expect(prisma.indexSeries.findMany).not.toHaveBeenCalled();
        expect(result.installmentResults[0]).toMatchObject({ correctionFactor: 1, correctedValue: 1000, monthBreakdown: [] });
        expect(result.moratoryInterest).toBe(60);   // 1% a.m. por 6 meses
        expect(result.multaValue).toBe(20);         // 2% de 1.000
        expect(result.feesValue).toBe(108);         // 10% de 1.000 + 60 + 20
        expect(result.totalValue).toBe(1188);
    });

    it('"Não atualizar (fixo)" também não corrige os abatimentos', async () => {
        const result = await calculateJudicialDebt({
            ...params,
            installments: [
                ...params.installments,
                { baseValue: 100, baseDate: '2026-03-10T00:00:00.000Z', type: 'ABATIMENTO', deductionPoint: 'APOS_TUDO' },
            ],
        }, 2026, 7);

        expect(result.abatimentoResults[0]).toMatchObject({ correctionFactor: 1, correctedValue: 100 });
        expect(result.totalValue).toBe(1088);
    });

    it('com um índice, corrige o principal pela série gravada', async () => {
        prisma.indexSeries.findMany.mockResolvedValue([
            { year: 2026, month: 2, monthlyRate: 1, accumulatedValue: null },
            { year: 2026, month: 3, monthlyRate: 2, accumulatedValue: null },
        ]);

        const result = await calculateJudicialDebt({ ...params, correctionIndex: 'IPCA' }, 2026, 3);

        expect(prisma.indexSeries.findMany.mock.calls[0][0].where.indexName).toBe('IPCA');
        expect(result.installmentResults[0].correctionFactor).toBeCloseTo(1.0302, 8);
        expect(result.correctedValue).toBe(1030.2);
    });
});
