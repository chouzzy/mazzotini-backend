import { PrismaClient } from '@prisma/client';
import {
    calculateJudicialDebt, CalculationParams, combineResults, NAO_ATUALIZAR, TAXA_LEGAL, TAXA_LEGAL_TEMA1368,
} from './judicialCalculatorService';

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
        expect(result.feesValue).toBe(106);         // 10% de 1.000 + 60, sem a multa (padrão do Dr. Calc)
        expect(result.totalValue).toBe(1186);
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
        expect(result.totalValue).toBe(1086);
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

        it('a taxa somada da parcela fica com 6 casas: R$ 10 milhões de 15/06/2024 até 12/2024 dão R$ 476.429,80', async () => {
            mockSeries({ [TAXA_LEGAL]: [row(2024, 8, 0.605306), row(2024, 9, 0.676227), row(2024, 10, 0.704241), row(2024, 11, 0.385874)] });

            const result = await calculateJudicialDebt({ ...legal('2024-06-15'), installments: [{ baseValue: 10_000_000, baseDate: '2024-06-15T00:00:00.000Z' }] }, 2024, 12);

            // 4,764298% (sem arredondar a taxa, seriam R$ 476.429,81)
            expect(result.moratoryInterest).toBe(476429.8);
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

            expect(result.penaltyValue).toBe(202.46);   // multa e honorários de 10%: 101,23 cada, como no Dr. Calc
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

        it('custa mais antiga que o débito: IPCA desde 12/2022, R$ 1.115,74, como no Dr. Calc', async () => {
            mockSeries({ IPCA: ipca });

            const result = await calculateJudicialDebt(comCusta('2022-12-15', { correctionIndex: 'IPCA' }), 2023, 3);

            expect(result.custaTotal).toBe(102);
            expect(result.totalValue).toBe(1115.74);
        });

        it('TJSP: a custa mais antiga divide pelo acumulado do mês dela, que precisa estar no banco', async () => {
            const dezembro = row(2022, 12, 0, 89.222653);
            mockSeries({ TJSP_LEI14905: [dezembro, ...tjsp] });

            const result = await calculateJudicialDebt(comCusta('2022-12-15', { correctionIndex: 'TJSP_LEI14905' }), 2023, 3);

            expect(result.custaResults[0].correctionFactor).toBeCloseTo(90.946481 / 89.222653, 8);
            expect(result.custaTotal).toBe(101.93);

            mockSeries({ TJSP_LEI14905: tjsp });
            await expect(calculateJudicialDebt(comCusta('2022-12-15', { correctionIndex: 'TJSP_LEI14905' }), 2023, 3)).rejects.toThrow(
                'O banco de índices tem TJSP só a partir de 01/2023, e o cálculo precisa de 12/2022.');
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

    describe('arredondamento por linha', () => {
        /** Parcelas fictícias com a mesma data. */
        const parcels = (values: number[], baseDate = '2023-01-15') =>
            values.map((baseValue, i) => ({ baseValue, baseDate: `${baseDate}T00:00:00.000Z`, description: `Parcela ${i + 1}` }));
        // Acumulados da tabela do TJSP
        const tjsp2023 = [
            row(2023, 1, 0, 89.838289), row(2023, 2, 0, 90.251545), row(2023, 3, 0, 90.946481), row(2023, 4, 0, 91.528538),
            row(2023, 5, 0, 92.013639), row(2023, 6, 0, 92.344888), row(2023, 7, 0, 92.252543), row(2023, 8, 0, 92.169515),
        ];

        it('os juros correm sobre o valor corrigido já arredondado: R$ 1.135,85', async () => {
            mockSeries({ TJSP_LEI14905: tjsp2023 });

            const result = await calculateJudicialDebt(
                plain('2023-01-15', { correctionIndex: 'TJSP_LEI14905', moratoryRate: 1, feesPercentage: 10 }), 2023, 3);

            expect(result.correctedValue).toBe(1012.34);
            expect(result.moratoryInterest).toBe(20.25);
            expect(result.feesValue).toBe(103.26);
            expect(result.totalValue).toBe(1135.85);
        });

        it('meio centavo arredonda para cima, e os juros do total somam as linhas: R$ 1.436,28', async () => {
            const result = await calculateJudicialDebt({
                ...plain('2023-01-15', { moratoryRate: 1, multaPercentage: 1 }),
                installments: parcels([100.5, 102.5, 104.5, 100.1, 1000.5]),
            }, 2023, 2);

            expect(result.installmentResults.map(i => i.moratoryInterest)).toEqual([1.01, 1.03, 1.05, 1, 10.01]);
            expect(result.moratoryInterest).toBe(14.1);
            // A multa sai do total corrigido (1% de 1.408,10), e não da soma da multa de cada linha (14,10)
            expect(result.multaValue).toBe(14.08);
            expect(result.totalValue).toBe(1436.28);
        });

        it('a multa sai do total corrigido e os honorários, das linhas arredondadas: R$ 1.135,48', async () => {
            const result = await calculateJudicialDebt({
                ...plain('2023-01-15', { moratoryRate: 1, multaPercentage: 2, feesPercentage: 10 }),
                installments: parcels(Array(10).fill(100.4)),
            }, 2023, 2);

            expect(result.moratoryInterest).toBe(10);   // R$ 1,00 por linha (1,004)
            expect(result.multaValue).toBe(20.08);
            expect(result.feesValue).toBe(101.4);
            expect(result.totalValue).toBe(1135.48);
        });

        it('o total corrigido soma as linhas, e cada 10% do Art. 523 é arredondado: R$ 1.368,45', async () => {
            mockSeries({ TJSP_LEI14905: tjsp2023 });

            const result = await calculateJudicialDebt({
                ...plain('2023-01-15', { correctionIndex: 'TJSP_LEI14905', moratoryRate: 1, feesPercentage: 10, penaltyPercentage: 20 }),
                installments: parcels(Array(10).fill(100.4)),
            }, 2023, 3);

            expect(result.correctedValue).toBe(1016.4);   // R$ 101,64 por linha
            expect(result.moratoryInterest).toBe(20.3);
            expect(result.feesValue).toBe(103.67);
            expect(result.penaltyValue).toBe(228.08);     // R$ 114,04 de multa e R$ 114,04 de honorários
            expect(result.totalValue).toBe(1368.45);
        });

        it('três parcelas com juros remuneratórios e moratórios, multa, honorários e Art. 523: R$ 1.559,16', async () => {
            mockSeries({ TJSP_LEI14905: tjsp2023 });

            const result = await calculateJudicialDebt({
                ...plain('2023-01-15', {
                    correctionIndex: 'TJSP_LEI14905', moratoryRate: 1, compensatoryRate: 0.5, multaPercentage: 2,
                    feesPercentage: 15, penaltyPercentage: 20,
                }),
                installments: [...parcels([333.33], '2023-01-15'), ...parcels([333.33], '2023-02-15'), ...parcels([333.34], '2023-03-15')],
            }, 2023, 8);

            expect(result.installmentResults.map(i => [i.correctedValue, i.compensatoryInterest, i.moratoryInterest])).toEqual([
                [341.98, 11.97, 23.94], [340.41, 10.21, 20.42], [337.82, 8.45, 16.89],
            ]);
            expect(result.multaValue).toBe(20.4);
            expect(result.subtotalA).toBe(1132.49);
            expect(result.feesValue).toBe(166.81);
            expect(result.totalValue).toBe(1559.16);
        });
    });

    describe('opções "honorários sobre a multa" e "deflacionar"', () => {
        it('sem a opção, os honorários não incidem sobre a multa, mas o Art. 523 incide sobre ela: R$ 1.440,00', async () => {
            const result = await calculateJudicialDebt(
                plain('2023-01-15', { multaPercentage: 10, feesPercentage: 10, penaltyPercentage: 20 }), 2023, 3);

            expect(result.feesValue).toBe(100);
            expect(result.penaltyValue).toBe(240);
            expect(result.totalValue).toBe(1440);
        });

        it('com a opção, os honorários incidem também sobre a multa: R$ 1.452,00', async () => {
            const result = await calculateJudicialDebt(
                plain('2023-01-15', { multaPercentage: 10, feesPercentage: 10, penaltyPercentage: 20, feesOnMulta: true }), 2023, 3);

            expect(result.feesValue).toBe(110);
            expect(result.totalValue).toBe(1452);
        });

        // TJPR de 06/2023 e 07/2023: médias do INPC e do IGP-DI de maio e de junho, negativas
        const tjprDeflacao = [row(2023, 6, -0.985), row(2023, 7, -0.775)];
        const comCreditoECusta = (extra: Partial<CalculationParams> = {}): CalculationParams => {
            const base = plain('2023-05-15', { correctionIndex: 'TJPR_MEDIA_INPC_IGPDI', ...extra });
            return {
                ...base,
                installments: [
                    ...base.installments,
                    { baseValue: -100, baseDate: '2023-05-15T00:00:00.000Z', description: 'Crédito' },
                    { baseValue: 100, baseDate: '2023-05-15T00:00:00.000Z', description: 'Custa', type: 'CUSTA' },
                ],
            };
        };

        it('sem deflacionar, a inflação negativa não reduz o débito, o crédito nem a custa abaixo do nominal', async () => {
            mockSeries({ TJPR_MEDIA_INPC_IGPDI: tjprDeflacao });

            const result = await calculateJudicialDebt(comCreditoECusta(), 2023, 7);

            expect(result.installmentResults.map(i => i.correctedValue)).toEqual([1000, -100]);
            expect(result.custaResults[0].correctedValue).toBe(100);
            expect(result.totalValue).toBe(1000);
        });

        it('com deflacionar, o débito vai a R$ 982,48 e o crédito a R$ 98,25, como no Dr. Calc, e a custa também cai', async () => {
            mockSeries({ TJPR_MEDIA_INPC_IGPDI: tjprDeflacao });

            const result = await calculateJudicialDebt(comCreditoECusta({ deflate: true }), 2023, 7);

            expect(result.installmentResults.map(i => i.correctedValue)).toEqual([982.48, -98.25]);
            expect(result.custaResults[0].correctedValue).toBe(98.25);
            expect(result.totalValue).toBe(982.48);
        });

        it('vale o fator da parcela, não o de cada mês: IPCA de 06/2017 até 09/2017 dá R$ 1.001,99 com ou sem a opção', async () => {
            mockSeries({ IPCA: [row(2017, 6, -0.23), row(2017, 7, 0.24), row(2017, 8, 0.19)] });

            for (const deflate of [false, true]) {
                const result = await calculateJudicialDebt(plain('2017-06-15', { correctionIndex: 'IPCA', deflate }), 2017, 9);
                expect(result.totalValue).toBe(1001.99);
            }
        });

        it('antes do Real, o fator do TJSP também converte a moeda e fica abaixo de 1 sem ser deflação', async () => {
            // Acumulados fictícios, com a troca de cruzeiro real para real (÷ 2.750) dentro do acumulado
            mockSeries({ TJSP_LEI14905: [row(1994, 6, 0, 2750), row(1994, 7, 0, 1.1), row(1994, 8, 0, 1.2)] });

            const result = await calculateJudicialDebt(plain('1994-06-15', { correctionIndex: 'TJSP_LEI14905' }), 1994, 8);

            expect(result.installmentResults[0].correctedValue).toBe(0.44);   // 1.000 × 1,2 / 2.750
        });
    });

    describe('taxa legal + Tema 1368 nos juros de mora', () => {
        const tema1368 = (baseDate: string, extra: Partial<CalculationParams> = {}) =>
            plain(baseDate, { moratoryMode: TAXA_LEGAL_TEMA1368, ...extra });
        // Taxas da série, calculadas com a SELIC e o IPCA-E publicados pelo BCB
        const serie = [
            row(1995, 3, 2.0055325), row(1995, 4, 2.94233807), row(1995, 5, 2.26581658),
            row(2002, 1, 0.83540527), row(2006, 1, 1.08587368), row(2006, 4, 1.04842284), row(2010, 1, 0.3455539),
            row(2020, 12, 0), row(2023, 1, 0.60019399), row(2024, 6, 0.39072282), row(2024, 7, 0.39678952),
        ];

        it.each([
            ['01/2002', '2002-01-15', 2002, 2, 8.35],
            ['01/2006, com a SELIC de 12/2005 de 2 casas', '2006-01-15', 2006, 2, 10.86],
            ['04/2006, com a SELIC de 03/2006 acumulada das taxas diárias', '2006-04-15', 2006, 5, 10.48],
            ['01/2010', '2010-01-15', 2010, 2, 3.46],
            ['12/2020, em que a taxa seria negativa', '2020-12-15', 2021, 1, 0],
            ['01/2023', '2023-01-15', 2023, 2, 6],
        ])('um mês de juros em %s dá o mesmo que o Dr. Calc', async (_, baseDate, refYear, refMonth, interest) => {
            mockSeries({ [TAXA_LEGAL_TEMA1368]: serie });

            const result = await calculateJudicialDebt(tema1368(baseDate), refYear, refMonth);

            expect(result.moratoryInterest).toBe(interest);
            expect(result.warnings).toBeUndefined();
        });

        it('a partir de 08/2024, vale a taxa legal oficial do mês inteiro: de 15/06/2024 até 10/2024 são R$ 20,69', async () => {
            mockSeries({ [TAXA_LEGAL_TEMA1368]: serie, [TAXA_LEGAL]: [row(2024, 8, 0.605306), row(2024, 9, 0.676227)] });

            const result = await calculateJudicialDebt(tema1368('2024-06-15'), 2024, 10);

            expect(result.moratoryInterest).toBe(20.69);
            expect(result.installmentResults[0].moratoryMonths).toBe(4);
        });

        it('com correção: TJSP de 20/11/2004 até 02/2006 dá R$ 1.068,21 corrigidos e R$ 148,72 de juros, como no Dr. Calc', async () => {
            mockSeries({
                TJSP_LEI14905: [
                    row(2004, 11, 0, 32.533108), row(2004, 12, 0, 32.676253), row(2005, 1, 0, 32.957268), row(2005, 2, 0, 33.145124),
                    row(2005, 3, 0, 33.290962), row(2005, 4, 0, 33.533986), row(2005, 5, 0, 33.839145), row(2005, 6, 0, 34.076019),
                    row(2005, 7, 0, 34.038535), row(2005, 8, 0, 34.048746), row(2005, 9, 0, 34.048746), row(2005, 10, 0, 34.099819),
                    row(2005, 11, 0, 34.297597), row(2005, 12, 0, 34.482804), row(2006, 1, 0, 34.620735), row(2006, 2, 0, 34.752293),
                ],
                [TAXA_LEGAL_TEMA1368]: [
                    row(2004, 11, 0.88716108), row(2004, 12, 0.61611845), row(2005, 1, 0.63466878), row(2005, 2, 0.69527215),
                    row(2005, 3, 0.47647409), row(2005, 4, 1.1758844), row(2005, 5, 0.66507842), row(2005, 6, 0.66448478),
                    row(2005, 7, 1.46823811), row(2005, 8, 1.39846169), row(2005, 9, 1.37614679), row(2005, 10, 1.33785942),
                    row(2005, 11, 0.84526651), row(2005, 12, 0.59535622), row(2006, 1, 1.08587368),
                ],
            });

            const result = await calculateJudicialDebt(tema1368('2004-11-20', { correctionIndex: 'TJSP_LEI14905' }), 2006, 2);

            expect(result.correctedValue).toBe(1068.21);
            expect(result.moratoryInterest).toBe(148.72);
        });

        it('antes de 03/1995 não há taxa: os meses ficam sem juros e o cálculo avisa', async () => {
            mockSeries({ [TAXA_LEGAL_TEMA1368]: serie });

            const result = await calculateJudicialDebt(tema1368('1995-01-15'), 1995, 6);

            // Março a maio. O Dr. Calc dá R$ 59,50: a base dele tem outra SELIC em 02/1995 e 03/1995
            expect(result.moratoryInterest).toBe(72.14);
            expect(result.warnings).toEqual(['A taxa legal do Tema 1368 começa em 03/1995: os meses anteriores ficaram sem juros de mora, como no Dr. Calc.']);
        });

        it('a taxa somada da parcela fica com 6 casas: R$ 10 milhões em 01/2006 dão R$ 108.587,40, como no Dr. Calc', async () => {
            mockSeries({ [TAXA_LEGAL_TEMA1368]: serie });

            const result = await calculateJudicialDebt({ ...tema1368('2006-01-15'), installments: [{ baseValue: 10_000_000, baseDate: '2006-01-15T00:00:00.000Z' }] }, 2006, 2);

            // 1,085874% (sem arredondar a taxa, seriam R$ 108.587,37)
            expect(result.moratoryInterest).toBe(108587.4);
        });

        it('recusa quando a série ainda não foi carregada', async () => {
            await expect(calculateJudicialDebt(tema1368('2010-01-15'), 2010, 2))
                .rejects.toThrow('Não há dados de taxa legal do Tema 1368 no banco de índices. Avise o suporte.');
        });

        it('recusa um mês faltando, também depois do último gravado: a série é histórica', async () => {
            mockSeries({ [TAXA_LEGAL_TEMA1368]: [row(1995, 3, 2.0055325), row(2010, 1, 0.3455539)] });

            await expect(calculateJudicialDebt(tema1368('2009-12-15'), 2010, 2))
                .rejects.toThrow('Falta taxa legal do Tema 1368 de 12/2009 no banco de índices. Avise o suporte.');
            await expect(calculateJudicialDebt(tema1368('2010-01-15'), 2010, 3))
                .rejects.toThrow('Falta taxa legal do Tema 1368 de 02/2010 no banco de índices. Avise o suporte.');
        });
    });
});

describe('combineResults (vários cálculos no mesmo processo)', () => {
    // Dois contratos fictícios, sem correção, para os valores ficarem fáceis de conferir
    const contrato1 = () => calculateJudicialDebt(params, 2026, 7);   // total 1.186 (ver o primeiro teste)
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

        expect(combined.totalValue).toBe(1706);
        expect(combined.baseTotal).toBe(1500);
        expect(combined.moratoryInterest).toBe(80);
        expect(combined.installmentResults.map(i => [i.installmentIndex, i.description])).toEqual([
            [1, 'Contrato 1 · Parcela exemplo'],
            [2, 'Contrato 2 · Parcela B'],
        ]);
        expect(combined.calculations).toEqual([
            { label: 'Contrato 1', baseTotal: 1000, correctedValue: 1000, totalValue: 1186 },
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
        expect(combined.totalValue).toBe(1086 + 520);
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
        expect(combined.totalValue).toBe(1186 + 150 + 520);
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
