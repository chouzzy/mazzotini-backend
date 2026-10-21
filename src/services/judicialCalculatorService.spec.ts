import { PrismaClient } from '@prisma/client';
import { calculateJudicialDebt, CalculationParams, combineResults, NAO_ATUALIZAR, TAXA_LEGAL } from './judicialCalculatorService';

jest.mock('@prisma/client', () => {
    const mPrisma: any = { indexSeries: { findMany: jest.fn(), findFirst: jest.fn() } };
    return { PrismaClient: jest.fn(() => mPrisma) };
});

const prisma = new PrismaClient() as any;

type Row = { year: number; month: number; monthlyRate: number; accumulatedValue: number | null };
const row = (year: number, month: number, monthlyRate: number, accumulatedValue: number | null = null): Row =>
    ({ year, month, monthlyRate, accumulatedValue });

/** Banco simulado: as linhas gravadas de cada índice. findFirst devolve o primeiro e o último mês. */
function mockSeries(series: Record<string, Row[]>) {
    const rowsOf = (indexName: string) => series[indexName] ?? [];
    prisma.indexSeries.findMany.mockImplementation(({ where }: any) => Promise.resolve(
        rowsOf(where.indexName).filter(r => where.OR.some((w: any) => w.year === r.year && w.month === r.month))));
    prisma.indexSeries.findFirst.mockImplementation(({ where, orderBy }: any) => {
        const rows = [...rowsOf(where.indexName)].sort((a, b) => (a.year * 12 + a.month) - (b.year * 12 + b.month));
        const pick = orderBy[0].year === 'asc' ? rows[0] : rows[rows.length - 1];
        return Promise.resolve(pick ? { year: pick.year, month: pick.month } : null);
    });
}

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

/** Parcela fictícia de R$ 1.000 sem juros, multa nem honorários, para isolar cada regra. */
const plain = (baseDate: string, extra: Partial<CalculationParams> = {}): CalculationParams => ({
    ...params,
    moratoryRate:    0,
    multaPercentage: 0,
    feesPercentage:  0,
    installments:    [{ baseValue: 1000, baseDate: `${baseDate}T00:00:00.000Z`, description: 'Parcela exemplo' }],
    ...extra,
});

beforeEach(() => {
    jest.clearAllMocks();
    mockSeries({});
});

describe('calculateJudicialDebt', () => {
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

    it('com um índice de preço, corrige do mês da parcela ao mês anterior ao de referência', async () => {
        mockSeries({ IPCA: [row(2026, 1, 1), row(2026, 2, 2), row(2026, 3, 5)] });

        const result = await calculateJudicialDebt({ ...params, correctionIndex: 'IPCA' }, 2026, 3);

        expect(prisma.indexSeries.findMany.mock.calls[0][0].where.indexName).toBe('IPCA');
        expect(result.installmentResults[0].correctionFactor).toBeCloseTo(1.0302, 8);
        expect(result.installmentResults[0].monthBreakdown.map(m => `${m.month}/${m.year}`)).toEqual(['1/2026', '2/2026']);
        expect(result.correctedValue).toBe(1030.2);
        expect(result.warnings).toBeUndefined();
    });
});

describe('fator de correção com a tabela oficial (acumulado)', () => {
    const tjsp = { ...params, correctionIndex: 'TJSP_LEI14905' };
    // Taxa mensal gravada errada (9%) nos meses da tabela, como depois de um seed antigo
    const official = [
        row(2026, 1, 9, 100),
        row(2026, 2, 9, 101),
        row(2026, 3, 9, 103.02),
    ];

    it('usa a razão entre os acumulados e ignora a taxa mensal gravada', async () => {
        mockSeries({ TJSP_LEI14905: official });

        const inst = (await calculateJudicialDebt(tjsp, 2026, 3)).installmentResults[0];

        expect(inst.correctionFactor).toBeCloseTo(1.0302, 8);
        expect(inst.monthBreakdown.map(m => m.monthlyRate)).toEqual([expect.closeTo(1, 8), expect.closeTo(2, 8)]);
    });

    it('sem acumulado na referência, usa a tabela até o último mês e a taxa mensal depois', async () => {
        mockSeries({ TJSP_LEI14905: [...official.slice(0, 2), row(2026, 3, 2)] });

        // Abril ainda não tem linha: conta 0% e vira um aviso
        const result = await calculateJudicialDebt(tjsp, 2026, 4);

        expect(result.installmentResults[0].correctionFactor).toBeCloseTo(1.01 * 1.02, 8);
        expect(result.warnings).toEqual(['TJSP de 04/2026 ainda sem valor no banco: o mês entrou como 0%.']);
    });

    it('um mês sem acumulado no meio não muda o fator até o próximo mês da tabela', async () => {
        mockSeries({ TJSP_LEI14905: [official[0], row(2026, 2, 5), official[2]] });

        const inst = (await calculateJudicialDebt(tjsp, 2026, 3)).installmentResults[0];

        expect(inst.correctionFactor).toBeCloseTo(1.0302, 8);
    });

    it('parcela de dezembro: a tabela começa em janeiro do ano seguinte', async () => {
        mockSeries({ TJSP_LEI14905: [row(2025, 12, 0, 100), row(2026, 1, 0, 102)] });

        const inst = (await calculateJudicialDebt({ ...tjsp, installments: [{ baseValue: 1000, baseDate: '2025-12-10T00:00:00.000Z' }] }, 2026, 1)).installmentResults[0];

        expect(inst.correctionFactor).toBeCloseTo(1.02, 8);
        expect(inst.monthBreakdown.map(m => `${m.month}/${m.year}`)).toEqual(['1/2026']);
    });

    it('parcela no mês de referência ou depois dele não pede o mês da parcela nem gera aviso', async () => {
        mockSeries({ TJSP_LEI14905: official });   // tabela até 03/2026

        for (const baseDate of ['2026-04-03', '2026-05-10']) {
            const result = await calculateJudicialDebt(plain(baseDate, { correctionIndex: 'TJSP_LEI14905' }), 2026, 4);

            expect(result.totalValue).toBe(1000);
            expect(result.warnings).toBeUndefined();
        }
    });

    it('com a série só de taxas (sem a tabela oficial), a parcela anterior ao primeiro mês usa as linhas seguintes', async () => {
        // A linha de 01/2000 já traz o índice de 12/1999
        mockSeries({ TJSP_LEI14905: [row(2000, 1, 1), row(2000, 2, 2)] });

        const result = await calculateJudicialDebt(plain('1999-12-15', { correctionIndex: 'TJSP_LEI14905' }), 2000, 2);

        expect(result.installmentResults[0].correctionFactor).toBeCloseTo(1.01 * 1.02, 8);
        expect(result.warnings).toBeUndefined();
    });
});

// Os valores esperados abaixo saíram do "Cálculo de débitos judiciais" do Dr. Calc (drcalc.net), a
// referência do escritório, com as mesmas parcelas fictícias. Os índices são os publicados (IBGE, BCB).
describe('convenções do Dr. Calc', () => {
    describe('correção monetária', () => {
        it('IPCA: R$ 1.000 de 15/01/2023 até 03/2023 dá R$ 1.013,74 (inflação de janeiro e fevereiro)', async () => {
            mockSeries({ IPCA: [row(2022, 12, 0.62), row(2023, 1, 0.53), row(2023, 2, 0.84), row(2023, 3, 0.71)] });

            const result = await calculateJudicialDebt(plain('2023-01-15', { correctionIndex: 'IPCA' }), 2023, 3);

            expect(result.totalValue).toBe(1013.74);
        });

        it('INPC: a mesma parcela dá R$ 1.012,34', async () => {
            mockSeries({ INPC: [row(2022, 12, 0.69), row(2023, 1, 0.46), row(2023, 2, 0.77), row(2023, 3, 0.64)] });

            const result = await calculateJudicialDebt(plain('2023-01-15', { correctionIndex: 'INPC' }), 2023, 3);

            expect(result.totalValue).toBe(1012.34);
        });

        it('TJPR: a linha do mês já traz a média do mês anterior, e o resultado é o mesmo (R$ 1.006,66)', async () => {
            mockSeries({ TJPR_MEDIA_INPC_IGPDI: [row(2023, 1, 0.5), row(2023, 2, 0.26), row(2023, 3, 0.405)] });

            const result = await calculateJudicialDebt(plain('2023-01-15', { correctionIndex: 'TJPR_MEDIA_INPC_IGPDI' }), 2023, 3);

            expect(result.totalValue).toBe(1006.66);
        });

        it('parcela no próprio mês de referência não é corrigida', async () => {
            mockSeries({ IPCA: [row(2023, 3, 0.71)] });

            const result = await calculateJudicialDebt(plain('2023-03-10', { correctionIndex: 'IPCA' }), 2023, 3);

            expect(result.totalValue).toBe(1000);
        });
    });

    describe('taxa legal nos juros de mora', () => {
        const legal = (baseDate: string) => plain(baseDate, { moratoryMode: 'TAXA_LEGAL' });

        it('12% a.a. pelos dias de cada mês: de 15/01/2023 até 03/2023 são R$ 19,40', async () => {
            const result = await calculateJudicialDebt(legal('2023-01-15'), 2023, 3);

            expect(result.moratoryInterest).toBe(19.4);
            expect(result.installmentResults[0].moratoryMonths).toBe(2);
            expect(prisma.indexSeries.findMany).not.toHaveBeenCalled();
        });

        it('troca de 6% para 12% a.a. em 12/02/2003: de 15/01/2003 até 04/2003 são R$ 22,68', async () => {
            const result = await calculateJudicialDebt(legal('2003-01-15'), 2003, 4);

            expect(result.moratoryInterest).toBe(22.68);
        });

        it('desde 30/08/2024, soma a taxa legal oficial de cada mês: de 15/01/2025 até 06/2025 são R$ 24,37', async () => {
            mockSeries({ [TAXA_LEGAL]: [row(2025, 1, 0.5894), row(2025, 2, 0.9022), row(2025, 3, 0), row(2025, 4, 0.322), row(2025, 5, 0.6232), row(2025, 6, 0.776)] });

            const result = await calculateJudicialDebt(legal('2025-01-15'), 2025, 6);

            expect(result.moratoryInterest).toBe(24.37);
            expect(result.installmentResults[0].moratoryMonths).toBe(5);
        });

        it('atravessando a Lei 14.905: de 15/01/2024 até 03/2025 são R$ 114,25', async () => {
            mockSeries({ [TAXA_LEGAL]: [
                row(2024, 8, 0.605306), row(2024, 9, 0.6762), row(2024, 10, 0.7042), row(2024, 11, 0.3859),
                row(2024, 12, 0.1719), row(2025, 1, 0.5894), row(2025, 2, 0.9022),
            ] });

            const result = await calculateJudicialDebt(legal('2024-01-15'), 2025, 3);

            expect(result.moratoryInterest).toBe(114.25);
        });

        it('com data de início dos juros, conta dela para todas as parcelas', async () => {
            const result = await calculateJudicialDebt({
                ...legal('2023-01-15'),
                moratoryStartDate: '2022-12-01T00:00:00.000Z',
                installments: [
                    { baseValue: 1000, baseDate: '2023-01-15T00:00:00.000Z' },
                    { baseValue: 1000, baseDate: '2023-02-15T00:00:00.000Z' },
                ],
            }, 2023, 3);

            // dez, jan e fev: (31 + 31 + 28) dias a 12% a.a., para cada parcela
            expect(result.moratoryInterest).toBe(59.18);
        });

        it('recusa quando falta a taxa legal de um mês no meio da série', async () => {
            mockSeries({ [TAXA_LEGAL]: [row(2025, 1, 0.5894), row(2025, 3, 0)] });

            await expect(calculateJudicialDebt(legal('2025-01-15'), 2025, 4))
                .rejects.toThrow('Falta taxa legal de 02/2025 no banco de índices. Avise o suporte.');
        });

        it('a taxa legal começa em 08/2024: um mês dela antes do primeiro gravado é falta de dado', async () => {
            mockSeries({ [TAXA_LEGAL]: [row(2024, 9, 0.6762), row(2024, 10, 0.7042)] });

            await expect(calculateJudicialDebt(legal('2024-08-15'), 2024, 11))
                .rejects.toThrow('Falta taxa legal de 08/2024 no banco de índices. Avise o suporte.');
        });

        it('recusa quando a taxa legal ainda não foi carregada', async () => {
            await expect(calculateJudicialDebt(legal('2025-01-15'), 2025, 4))
                .rejects.toThrow('Não há dados de taxa legal no banco de índices. Avise o suporte.');
        });

        it('mês depois do último publicado entra como 0% e vira um aviso', async () => {
            mockSeries({ [TAXA_LEGAL]: [row(2025, 1, 0.5894), row(2025, 2, 0.9022)] });

            const result = await calculateJudicialDebt(legal('2025-01-15'), 2025, 4);

            expect(result.moratoryInterest).toBe(14.92);
            expect(result.warnings).toEqual(['Taxa legal de 03/2025 ainda sem valor no banco: o mês entrou como 0%.']);
        });
    });

    describe('Art. 523', () => {
        it('os honorários do 523 são sempre 10%: com honorários de 15%, o total é R$ 1.380,00', async () => {
            const result = await calculateJudicialDebt(
                plain('2023-01-15', { feesPercentage: 15, penaltyPercentage: 10, feesOnPenalty: true }), 2023, 3);

            expect(result.totalValue).toBe(1380);
        });

        it('com honorário fixo, a multa e os honorários do 523 incidem sobre o débito com ele: R$ 1.440,00', async () => {
            const result = await calculateJudicialDebt(
                plain('2023-01-15', { feesMode: 'FIXO', feesFixedValue: 200, penaltyPercentage: 10, feesOnPenalty: true }), 2023, 3);

            expect(result.totalValue).toBe(1440);
        });
    });

    describe('custas e despesas', () => {
        /** O débito de R$ 1.000,00 em 15/01/2023 e uma custa de R$ 100,00, como nos casos do Dr. Calc. */
        const comCusta = (custaDate: string, extra: Partial<CalculationParams> = {}): CalculationParams => {
            const base = plain('2023-01-15', extra);
            return {
                ...base,
                installments: [...base.installments, { baseValue: 100, baseDate: `${custaDate}T00:00:00.000Z`, description: 'Custa', type: 'CUSTA' }],
            };
        };
        const ipca = [row(2022, 12, 0.62), row(2023, 1, 0.53), row(2023, 2, 0.84), row(2023, 3, 0.71)];
        // Acumulados da tabela do TJSP
        const tjsp = [row(2023, 1, 0, 89.838289), row(2023, 2, 0, 90.251545), row(2023, 3, 0, 90.946481)];

        it('a custa só é corrigida, pelo índice do cálculo, e entra no fim: IPCA, R$ 1.115,11', async () => {
            mockSeries({ IPCA: ipca });

            const result = await calculateJudicialDebt(comCusta('2023-01-15', { correctionIndex: 'IPCA' }), 2023, 3);

            expect(result.custaResults).toEqual([{
                description: 'Custa', baseDate: '2023-01-15T00:00:00.000Z', baseValue: 100,
                correctionFactor: expect.closeTo(1.0137445, 6), correctedValue: 101.37,
            }]);
            expect(result.custaTotal).toBe(101.37);
            // A custa fica fora do valor do débito, sobre o qual correm juros, multa e honorários
            expect(result.correctedValue).toBe(1013.74);
            expect(result.totalValue).toBe(1115.11);
        });

        it('TJSP: R$ 1.113,57', async () => {
            mockSeries({ TJSP_LEI14905: tjsp });

            const result = await calculateJudicialDebt(comCusta('2023-01-15', { correctionIndex: 'TJSP_LEI14905' }), 2023, 3);

            expect(result.custaTotal).toBe(101.23);
            expect(result.totalValue).toBe(1113.57);
        });

        it('cada custa é corrigida a partir da própria data: em 15/02/2023, R$ 1.114,58', async () => {
            mockSeries({ IPCA: ipca });

            const result = await calculateJudicialDebt(comCusta('2023-02-15', { correctionIndex: 'IPCA' }), 2023, 3);

            expect(result.custaTotal).toBe(100.84);
            expect(result.totalValue).toBe(1114.58);
        });

        it('a multa e os honorários do Art. 523 não incidem sobre a custa: R$ 1.316,03', async () => {
            mockSeries({ TJSP_LEI14905: tjsp });

            const result = await calculateJudicialDebt(comCusta('2023-01-15', { correctionIndex: 'TJSP_LEI14905', penaltyPercentage: 20 }), 2023, 3);

            expect(result.penaltyValue).toBe(202.47);
            expect(result.totalValue).toBe(1316.03);
        });

        it('nem juros nem honorários: com juros de 1% a.m. e honorários de 10%, R$ 1.222,00 (o caso de R$ 1.322,00 do Dr. Calc, sem a multa)', async () => {
            const result = await calculateJudicialDebt(comCusta('2023-01-15', { moratoryRate: 1, feesPercentage: 10 }), 2023, 3);

            expect(result.moratoryInterest).toBe(20);
            expect(result.feesValue).toBe(102);
            expect(result.totalValue).toBe(1222);
        });

        it('a custa com data depois do mês de referência entra pelo valor, sem correção: R$ 1.112,34', async () => {
            mockSeries({ TJSP_LEI14905: tjsp });

            const result = await calculateJudicialDebt(comCusta('2023-04-15', { correctionIndex: 'TJSP_LEI14905' }), 2023, 3);

            expect(result.custaResults[0]).toMatchObject({ correctionFactor: 1, correctedValue: 100 });
            expect(result.totalValue).toBe(1112.34);
        });

        it('sem custas, o resultado vem com a lista vazia e o total de custas zerado', async () => {
            const result = await calculateJudicialDebt(plain('2023-01-15'), 2023, 3);

            expect(result.custaResults).toEqual([]);
            expect(result.custaTotal).toBe(0);
        });

        it('a data da custa também é conferida no banco de índices', async () => {
            mockSeries({ IPCA: [row(2000, 1, 0.62), row(2000, 2, 0.13)] });
            const params = plain('2000-01-15', { correctionIndex: 'IPCA' });
            params.installments.push({ baseValue: 100, baseDate: '1999-12-15T00:00:00.000Z', type: 'CUSTA' });

            await expect(calculateJudicialDebt(params, 2000, 3)).rejects.toThrow(
                'O banco de índices tem IPCA só a partir de 01/2000, e o cálculo precisa de 12/1999. Mude a data da parcela, escolha outro índice ou avise o suporte.');
        });

        it('"Não atualizar (fixo)" também recusa a custa anterior ao Real', async () => {
            await expect(calculateJudicialDebt(comCusta('1990-01-15'), 2023, 3)).rejects.toThrow(
                '"Não atualizar (fixo)" vale para datas a partir de 01/07/1994. Mude a data da parcela de 15/01/1990 ou escolha outro índice.');
        });
    });

    describe('mês sem índice', () => {
        it('recusa um mês faltando no meio da série', async () => {
            mockSeries({ IPCA: [row(2023, 1, 0.53), row(2023, 3, 0.71)] });

            await expect(calculateJudicialDebt(plain('2023-01-15', { correctionIndex: 'IPCA' }), 2023, 4))
                .rejects.toThrow('Falta IPCA de 02/2023 no banco de índices. Avise o suporte.');
        });

        it('recusa uma data anterior ao início da série', async () => {
            mockSeries({ IPCA: [row(2000, 1, 0.62), row(2000, 2, 0.13)] });

            await expect(calculateJudicialDebt(plain('1999-12-15', { correctionIndex: 'IPCA' }), 2000, 3))
                .rejects.toThrow('O banco de índices tem IPCA só a partir de 01/2000, e o cálculo precisa de 12/1999. Mude a data da parcela, escolha outro índice ou avise o suporte.');
        });

        it('recusa um índice sem nenhum dado no banco', async () => {
            await expect(calculateJudicialDebt(plain('2023-01-15', { correctionIndex: 'TJPR_MEDIA_INPC_IGPDI' }), 2023, 3))
                .rejects.toThrow('Não há dados de TJPR no banco de índices. Avise o suporte.');
        });

        it('índice ainda não publicado entra como 0% e vira um aviso: R$ 1.004,97, como no Dr. Calc', async () => {
            mockSeries({ IPCA: [row(2026, 8, -0.32), row(2026, 9, 0.82)] });

            const result = await calculateJudicialDebt(plain('2026-08-15', { correctionIndex: 'IPCA' }), 2026, 11);

            expect(result.totalValue).toBe(1004.97);
            expect(result.warnings).toEqual(['IPCA de 10/2026 ainda sem valor no banco: o mês entrou como 0%.']);
        });

        it('índice que a tela antiga gravava é recusado com uma mensagem clara', async () => {
            await expect(calculateJudicialDebt(plain('2023-01-15', { correctionIndex: 'Outro' }), 2023, 3))
                .rejects.toThrow('Índice de correção desconhecido (Outro). Escolha um índice da lista.');
        });

        it('no TJSP, a parcela anterior ao primeiro mês da tabela é recusada', async () => {
            mockSeries({ TJSP_LEI14905: [row(1964, 10, 0, 1), row(1964, 11, 0, 1.05)] });

            await expect(calculateJudicialDebt(plain('1964-09-15', { correctionIndex: 'TJSP_LEI14905' }), 1964, 11))
                .rejects.toThrow('O banco de índices tem TJSP só a partir de 10/1964, e o cálculo precisa de 09/1964. Mude a data da parcela, escolha outro índice ou avise o suporte.');
        });

        it('"Não atualizar (fixo)" recusa datas anteriores ao Real', async () => {
            await expect(calculateJudicialDebt(plain('1990-01-15'), 2023, 3)).rejects.toThrow(
                '"Não atualizar (fixo)" vale para datas a partir de 01/07/1994. Mude a data da parcela de 15/01/1990 ou escolha outro índice.');
        });
    });
});

describe('combineResults (vários cálculos no mesmo processo)', () => {
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
        expect(combined.warnings).toBeUndefined();
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

    it('junta as custas de cada cálculo', async () => {
        const comCusta = await calculateJudicialDebt({
            ...params,
            installments: [
                ...params.installments,
                { baseValue: 150, baseDate: '2026-02-10T00:00:00.000Z', description: 'Perícia', type: 'CUSTA' },
            ],
        }, 2026, 7);

        const combined = combineResults([
            { label: 'Contrato 1', result: comCusta },
            { label: 'Contrato 2', result: await contrato2() },
        ]);

        expect(combined.custaResults.map(c => c.description)).toEqual(['Contrato 1 · Perícia']);
        expect(combined.custaTotal).toBe(150);
        // A custa não leva juros, multa nem honorários: soma 150 ao total do contrato 1
        expect(combined.totalValue).toBe(1188 + 150 + 520);
    });

    it('junta os avisos de cada cálculo, com o nome dele', async () => {
        mockSeries({ IPCA: [row(2026, 8, -0.32), row(2026, 9, 0.82)] });
        const comAviso = await calculateJudicialDebt(plain('2026-08-15', { correctionIndex: 'IPCA' }), 2026, 11);

        const combined = combineResults([
            { label: 'Contrato 1', result: await contrato1() },
            { label: 'Contrato 2', result: comAviso },
        ]);

        expect(combined.warnings).toEqual(['Contrato 2: IPCA de 10/2026 ainda sem valor no banco: o mês entrou como 0%.']);
    });
});
