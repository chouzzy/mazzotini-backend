import { PrismaClient } from '@prisma/client';
import { calculateJudicialDebt, CalculationParams, combineResults, NAO_ATUALIZAR } from './judicialCalculatorService';

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

describe('fator de correção com a tabela oficial (acumulado)', () => {
    const tjsp = { ...params, correctionIndex: 'TJSP_LEI14905' };
    // Taxa mensal gravada errada (9%) nos meses da tabela, como depois de um seed antigo
    const official = [
        { year: 2026, month: 1, monthlyRate: 9, accumulatedValue: 100 },
        { year: 2026, month: 2, monthlyRate: 9, accumulatedValue: 101 },
        { year: 2026, month: 3, monthlyRate: 9, accumulatedValue: 103.02 },
    ];

    beforeEach(() => jest.clearAllMocks());

    it('usa a razão entre os acumulados e ignora a taxa mensal gravada', async () => {
        prisma.indexSeries.findMany.mockResolvedValue(official);

        const inst = (await calculateJudicialDebt(tjsp, 2026, 3)).installmentResults[0];

        expect(inst.correctionFactor).toBeCloseTo(1.0302, 8);
        expect(inst.monthBreakdown.map(m => m.monthlyRate)).toEqual([expect.closeTo(1, 8), expect.closeTo(2, 8)]);
    });

    it('sem acumulado na referência, usa a tabela até o último mês e a taxa mensal depois', async () => {
        prisma.indexSeries.findMany.mockResolvedValue([
            ...official.slice(0, 2),
            { year: 2026, month: 3, monthlyRate: 2, accumulatedValue: null },
        ]);

        // Abril não tem linha: conta 0%
        const inst = (await calculateJudicialDebt(tjsp, 2026, 4)).installmentResults[0];

        expect(inst.correctionFactor).toBeCloseTo(1.01 * 1.02, 8);
    });

    it('um mês sem acumulado no meio não muda o fator até o próximo mês da tabela', async () => {
        prisma.indexSeries.findMany.mockResolvedValue([
            official[0],
            { year: 2026, month: 2, monthlyRate: 5, accumulatedValue: null },
            official[2],
        ]);

        const inst = (await calculateJudicialDebt(tjsp, 2026, 3)).installmentResults[0];

        expect(inst.correctionFactor).toBeCloseTo(1.0302, 8);
    });
});

describe('combineResults (vários cálculos no mesmo processo)', () => {
    beforeEach(() => jest.clearAllMocks());

    // Dois contratos fictícios, sem correção, para os valores ficarem fáceis de conferir
    const contrato1 = () => calculateJudicialDebt(params, 2026, 7);   // total 1.188 (ver o primeiro teste)
    const contrato2 = () => calculateJudicialDebt({
        ...params,
        multaPercentage: 0,
        feesPercentage:  0,
        installments: [{ baseValue: 500, baseDate: '2026-03-10T00:00:00.000Z', description: 'Parcela B' }],
    }, 2026, 7);                                                       // 500 + 4 meses a 1% = 520

    it('com um cálculo só, devolve o resultado como está', async () => {
        const result = await contrato1();

        expect(combineResults([{ label: 'Cálculo 1', result }])).toBe(result);
    });

    it('soma os cálculos e marca as parcelas com o nome de cada um', async () => {
        const combined = combineResults([
            { label: 'Contrato 1', result: await contrato1() },
            { label: 'Contrato 2', result: await contrato2() },
        ]);

        expect(combined.totalValue).toBe(1708);
        expect(combined.baseTotal).toBe(1500);
        expect(combined.moratoryInterest).toBe(80);
        expect(combined.installmentResults.map(i => [i.installmentIndex, i.description])).toEqual([
            [1, 'Contrato 1 · Parcela exemplo'],
            [2, 'Contrato 2 · Parcela B'],
        ]);
        expect(combined.calculations).toEqual([
            { label: 'Contrato 1', baseTotal: 1000, correctedValue: 1000, totalValue: 1188 },
            { label: 'Contrato 2', baseTotal: 500,  correctedValue: 500,  totalValue: 520 },
        ]);
    });

    it('junta os abatimentos de cada cálculo', async () => {
        const comAbatimento = await calculateJudicialDebt({
            ...params,
            installments: [
                ...params.installments,
                { baseValue: 100, baseDate: '2026-03-10T00:00:00.000Z', description: 'Depósito', type: 'ABATIMENTO', deductionPoint: 'APOS_TUDO' },
            ],
        }, 2026, 7);

        const combined = combineResults([
            { label: 'Contrato 1', result: comAbatimento },
            { label: 'Contrato 2', result: await contrato2() },
        ]);

        expect(combined.abatimentoResults.map(a => a.description)).toEqual(['Contrato 1 · Depósito']);
        expect(combined.abatimentoTotal).toBe(100);
        expect(combined.totalValue).toBe(1088 + 520);
    });
});
