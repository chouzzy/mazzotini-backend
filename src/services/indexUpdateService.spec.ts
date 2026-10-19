import { PrismaClient } from '@prisma/client';
import { updateIndexSeries } from './indexUpdateService';
import { fetchIndexSeries, fetchSelicSeries, fetchTJSPSeries } from './ibgeService';

jest.mock('@prisma/client', () => {
    const mPrisma: any = {
        indexSeries: { findFirst: jest.fn(), upsert: jest.fn() },
    };
    return { PrismaClient: jest.fn(() => mPrisma) };
});

jest.mock('./ibgeService', () => ({
    ...jest.requireActual('./ibgeService'),
    fetchIndexSeries: jest.fn(),
    fetchSelicSeries: jest.fn(),
    fetchTJSPSeries:  jest.fn(),
}));

const prisma = new PrismaClient() as any;

// Execução do cron em 05/11/2026
const NOV_5 = new Date(2026, 10, 5, 4, 0);

/** Banco simulado: último mês gravado por índice e último mês do TJSP com acumulado. */
let lastStored: Record<string, { year: number; month: number }>;
let lastOfficialTJSP: { year: number; month: number; accumulatedValue: number } | null;

/** Registros gravados (o `create` de cada upsert) de um índice. */
const saved = (indexName: string) => prisma.indexSeries.upsert.mock.calls
    .map((call: any) => call[0])
    .filter((args: any) => args.where.indexName_year_month.indexName === indexName);

describe('updateIndexSeries', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        lastStored = {};
        lastOfficialTJSP = null;
        prisma.indexSeries.findFirst.mockImplementation(({ where }: any) =>
            Promise.resolve(where.accumulatedValue ? lastOfficialTJSP : (lastStored[where.indexName] ?? null)));
        (fetchIndexSeries as jest.Mock).mockResolvedValue([]);
        (fetchSelicSeries as jest.Mock).mockResolvedValue([]);
        (fetchTJSPSeries as jest.Mock).mockResolvedValue([]);
    });

    it('busca cada índice mensal desde o último mês gravado até o mês atual', async () => {
        lastStored = { IPCA: { year: 2026, month: 5 } };
        (fetchIndexSeries as jest.Mock).mockImplementation((name: string) => Promise.resolve(name === 'IPCA'
            ? [{ year: 2026, month: 5, monthlyRate: 0.5 }, { year: 2026, month: 6, monthlyRate: 0.3 }]
            : []));

        await updateIndexSeries(NOV_5);

        expect(fetchIndexSeries).toHaveBeenCalledWith('IPCA', 2026, 5, 2026, 11);
        expect(saved('IPCA').map((a: any) => a.create)).toEqual([
            { indexName: 'IPCA', year: 2026, month: 5, monthlyRate: 0.5 },
            { indexName: 'IPCA', year: 2026, month: 6, monthlyRate: 0.3 },
        ]);
        // Índice sem nenhum mês gravado começa do mesmo ponto do seed
        expect(fetchIndexSeries).toHaveBeenCalledWith('IGP_M', 2000, 1, 2026, 11);
    });

    it('o CDI entra só até o mês anterior, e o CDI diário recebe os mesmos meses do mensal', async () => {
        lastStored = { CDI_MENSAL: { year: 2026, month: 9 } };
        (fetchIndexSeries as jest.Mock).mockImplementation((name: string) => Promise.resolve(name === 'CDI_MENSAL'
            ? [{ year: 2026, month: 9, monthlyRate: 1.1 }, { year: 2026, month: 10, monthlyRate: 1.2 }]
            : []));

        await updateIndexSeries(NOV_5);

        // Em novembro, o mês corrente do CDI ainda é parcial
        expect(fetchIndexSeries).toHaveBeenCalledWith('CDI_MENSAL', 2026, 9, 2026, 10);
        expect(saved('CDI_DIARIA').map((a: any) => a.create)).toEqual([
            { indexName: 'CDI_DIARIA', year: 2026, month: 9, monthlyRate: 1.1 },
            { indexName: 'CDI_DIARIA', year: 2026, month: 10, monthlyRate: 1.2 },
        ]);
    });

    it('a SELIC entra só até o mês anterior e completa o último mês gravado', async () => {
        lastStored = { SELIC: { year: 2026, month: 10 } }; // gravado no meio de outubro, parcial

        await updateIndexSeries(NOV_5);

        expect(fetchSelicSeries).toHaveBeenCalledWith(2026, 10, 2026, 10);
    });

    it('não busca a SELIC quando o mês anterior já foi gravado', async () => {
        lastStored = { SELIC: { year: 2026, month: 11 } };

        await updateIndexSeries(NOV_5);

        expect(fetchSelicSeries).not.toHaveBeenCalled();
    });

    it('estende o acumulado da tabela do TJSP mês a mês', async () => {
        lastOfficialTJSP = { year: 2026, month: 5, accumulatedValue: 100 };
        (fetchTJSPSeries as jest.Mock).mockResolvedValue([
            { year: 2026, month: 6, monthlyRate: 1 },
            { year: 2026, month: 7, monthlyRate: 2 },
        ]);

        await updateIndexSeries(NOV_5);

        expect(fetchTJSPSeries).toHaveBeenCalledWith(2026, 6, 2026, 11);
        const [june, july] = saved('TJSP_LEI14905');
        expect(june.create).toEqual({ indexName: 'TJSP_LEI14905', year: 2026, month: 6, monthlyRate: 1, accumulatedValue: 101 });
        expect(june.update).toEqual({ monthlyRate: 1, accumulatedValue: 101 });
        expect(july.create.accumulatedValue).toBeCloseTo(103.02, 10);
    });

    it('para de estender o TJSP num mês faltando', async () => {
        lastOfficialTJSP = { year: 2026, month: 5, accumulatedValue: 100 };
        (fetchTJSPSeries as jest.Mock).mockResolvedValue([
            { year: 2026, month: 6, monthlyRate: 1 },
            { year: 2026, month: 8, monthlyRate: 2 },
        ]);

        await updateIndexSeries(NOV_5);

        expect(saved('TJSP_LEI14905').map((a: any) => a.create.month)).toEqual([6]);
    });

    it('não busca o TJSP quando a tabela já chega ao mês atual', async () => {
        lastOfficialTJSP = { year: 2026, month: 11, accumulatedValue: 100 };

        await updateIndexSeries(NOV_5);

        expect(fetchTJSPSeries).not.toHaveBeenCalled();
    });

    it('sem a tabela oficial do TJSP no banco, grava só as taxas', async () => {
        lastStored = { TJSP_LEI14905: { year: 2026, month: 3 } };
        (fetchTJSPSeries as jest.Mock).mockResolvedValue([{ year: 2026, month: 4, monthlyRate: 0.44 }]);

        await updateIndexSeries(NOV_5);

        expect(fetchTJSPSeries).toHaveBeenCalledWith(2026, 3, 2026, 11);
        expect(saved('TJSP_LEI14905').map((a: any) => a.create)).toEqual([
            { indexName: 'TJSP_LEI14905', year: 2026, month: 4, monthlyRate: 0.44 },
        ]);
    });

    it('um índice com erro não impede os outros', async () => {
        (fetchIndexSeries as jest.Mock).mockImplementation((name: string) => name === 'IPCA_E'
            ? Promise.reject(new Error('BCB indisponível'))
            : Promise.resolve([{ year: 2026, month: 9, monthlyRate: 0.8 }]));

        const results = await updateIndexSeries(NOV_5);

        expect(results.find(r => r.indexName === 'IPCA_E')).toEqual({ indexName: 'IPCA_E', months: 0, error: 'BCB indisponível' });
        expect(results.find(r => r.indexName === 'IPCA')).toEqual({ indexName: 'IPCA', months: 1 });
        expect(fetchSelicSeries).toHaveBeenCalled();
        expect(fetchTJSPSeries).toHaveBeenCalled();
    });
});
