import { PrismaClient } from '@prisma/client';
import { ensureIndexSeriesLoaded, updateIndexSeries } from './indexUpdateService';
import { fetchIndexSeries, fetchSelicSeries, fetchTaxaLegalSeries, fetchTJMGSeries, fetchTJPRSeries, fetchTJSPSeries } from './ibgeService';

jest.mock('@prisma/client', () => {
    const mPrisma: any = {
        indexSeries: { findFirst: jest.fn(), upsert: jest.fn(), createMany: jest.fn() },
    };
    return { PrismaClient: jest.fn(() => mPrisma) };
});

jest.mock('./ibgeService', () => ({
    ...jest.requireActual('./ibgeService'),
    fetchIndexSeries: jest.fn(),
    fetchSelicSeries: jest.fn(),
    fetchTJSPSeries:  jest.fn(),
    fetchTJPRSeries:  jest.fn(),
    fetchTJMGSeries:  jest.fn(),
    fetchTaxaLegalSeries: jest.fn(),
}));

const prisma = new PrismaClient() as any;

// Execução do cron em 05/11/2026
const NOV_5 = new Date(2026, 10, 5, 4, 0);

/** Banco simulado: último mês gravado por índice e último mês do TJSP com acumulado. */
let lastStored: Record<string, { year: number; month: number }>;
let lastOfficialTJSP: { year: number; month: number; accumulatedValue: number } | null;

/** Upserts gravados de um índice. */
const saved = (indexName: string) => prisma.indexSeries.upsert.mock.calls
    .map((call: any) => call[0])
    .filter((args: any) => args.where.indexName_year_month.indexName === indexName);

const savedMonths = (indexName: string) => saved(indexName).map((a: any) => `${a.create.month}/${a.create.year}`);

/** Resposta fictícia do BCB: todos os meses do intervalo pedido, com a mesma taxa. */
const series = (rate: number) => (sy: number, sm: number, ey: number, em: number) => {
    const points = [];
    for (let y = sy, m = sm; y < ey || (y === ey && m <= em); m === 12 ? (y++, m = 1) : m++) {
        points.push({ year: y, month: m, monthlyRate: rate });
    }
    return Promise.resolve(points);
};

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
        (fetchTJPRSeries as jest.Mock).mockResolvedValue([]);
        (fetchTJMGSeries as jest.Mock).mockResolvedValue([]);
        (fetchTaxaLegalSeries as jest.Mock).mockResolvedValue([]);
    });

    it('as tabelas do TJPR e do TJMG vão do último mês gravado até o mês atual', async () => {
        lastStored = { TJPR_MEDIA_INPC_IGPDI: { year: 2026, month: 9 } };
        (fetchTJPRSeries as jest.Mock).mockResolvedValue([{ year: 2026, month: 9, monthlyRate: 0.4 }, { year: 2026, month: 10, monthlyRate: 0.5 }]);

        await updateIndexSeries(NOV_5);

        expect(fetchTJPRSeries).toHaveBeenCalledWith(2026, 9, 2026, 11);
        expect(savedMonths('TJPR_MEDIA_INPC_IGPDI')).toEqual(['9/2026', '10/2026']);
        // Sem nenhum mês gravado, começa do mesmo ponto do seed
        expect(fetchTJMGSeries).toHaveBeenCalledWith(2000, 1, 2026, 11);
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

    it('o CDI entra só até o mês anterior, e o CDI diário segue o próprio último mês', async () => {
        lastStored = { CDI_MENSAL: { year: 2026, month: 9 }, CDI_DIARIA: { year: 2026, month: 7 } };
        (fetchIndexSeries as jest.Mock).mockImplementation((name: string, sy: number, sm: number, ey: number, em: number) =>
            name === 'CDI_MENSAL' ? series(1.1)(sy, sm, ey, em) : Promise.resolve([]));

        await updateIndexSeries(NOV_5);

        // Em novembro, o mês corrente do CDI ainda é parcial
        expect(savedMonths('CDI_MENSAL')).toEqual(['9/2026', '10/2026']);
        // O CDI diário estava atrasado: recebe a mesma série a partir do próprio último mês
        expect(savedMonths('CDI_DIARIA')).toEqual(['7/2026', '8/2026', '9/2026', '10/2026']);
    });

    it('a SELIC entra só até o mês anterior e completa o último mês gravado', async () => {
        lastStored = { SELIC: { year: 2026, month: 10 } }; // gravado no meio de outubro, parcial

        await updateIndexSeries(NOV_5);

        expect(fetchSelicSeries).toHaveBeenCalledWith(2026, 10, 2026, 10);
    });

    it('não busca a SELIC quando o último mês gravado é o mês corrente', async () => {
        lastStored = { SELIC: { year: 2026, month: 11 } }; // parcial, gravado pelo seed

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
        expect(console.log).toHaveBeenCalledWith('  Índice TJSP_LEI14905: 2 meses gravados (06/2026 a 07/2026)');
    });

    it('para de estender o TJSP num mês faltando', async () => {
        lastOfficialTJSP = { year: 2026, month: 5, accumulatedValue: 100 };
        (fetchTJSPSeries as jest.Mock).mockResolvedValue([
            { year: 2026, month: 6, monthlyRate: 1 },
            { year: 2026, month: 8, monthlyRate: 2 },
        ]);

        await updateIndexSeries(NOV_5);

        expect(savedMonths('TJSP_LEI14905')).toEqual(['6/2026']);
    });

    it('não busca o TJSP quando a tabela já chega ao mês atual', async () => {
        lastOfficialTJSP = { year: 2026, month: 11, accumulatedValue: 100 };

        await updateIndexSeries(NOV_5);

        expect(fetchTJSPSeries).not.toHaveBeenCalled();
    });

    it('sem a tabela oficial do TJSP, regrava as taxas desde o início, sem emenda com a regra antiga', async () => {
        lastStored = { TJSP_LEI14905: { year: 2026, month: 3 } };
        (fetchTJSPSeries as jest.Mock).mockResolvedValue([{ year: 2026, month: 4, monthlyRate: 0.44 }]);

        await updateIndexSeries(NOV_5);

        expect(fetchTJSPSeries).toHaveBeenCalledWith(2000, 1, 2026, 11);
        expect(saved('TJSP_LEI14905').map((a: any) => a.create)).toEqual([
            { indexName: 'TJSP_LEI14905', year: 2026, month: 4, monthlyRate: 0.44 },
        ]);
    });

    it('na virada do ano, SELIC e CDI vão até dezembro e o TJSP chega a janeiro', async () => {
        lastStored = { SELIC: { year: 2026, month: 11 }, CDI_MENSAL: { year: 2026, month: 11 } };
        lastOfficialTJSP = { year: 2026, month: 12, accumulatedValue: 100 };

        await updateIndexSeries(new Date(2027, 0, 5, 4, 0));

        expect(fetchSelicSeries).toHaveBeenCalledWith(2026, 11, 2026, 12);
        expect(fetchIndexSeries).toHaveBeenCalledWith('CDI_MENSAL', 2026, 11, 2026, 12);
        expect(fetchTJSPSeries).toHaveBeenCalledWith(2027, 1, 2027, 1);
    });

    it('um índice com erro não impede os outros', async () => {
        (fetchIndexSeries as jest.Mock).mockImplementation((name: string) => {
            if (name === 'IPCA_E') return Promise.reject(new Error('BCB indisponível'));
            if (name === 'INPC') return Promise.reject('resposta sem Error');
            return Promise.resolve([{ year: 2026, month: 9, monthlyRate: 0.8 }]);
        });

        const results = await updateIndexSeries(NOV_5);

        expect(results.find(r => r.indexName === 'IPCA_E')).toEqual({ indexName: 'IPCA_E', months: 0, error: 'BCB indisponível' });
        expect(results.find(r => r.indexName === 'INPC')).toEqual({ indexName: 'INPC', months: 0, error: 'resposta sem Error' });
        expect(results.find(r => r.indexName === 'IPCA')).toEqual({ indexName: 'IPCA', months: 1 });
        expect(fetchSelicSeries).toHaveBeenCalled();
        expect(fetchTJSPSeries).toHaveBeenCalled();
    });

    it('a taxa legal vem inteira a cada execução, desde 08/2024', async () => {
        lastStored = { TAXA_LEGAL: { year: 2026, month: 10 } };
        (fetchTaxaLegalSeries as jest.Mock).mockResolvedValue([{ year: 2024, month: 8, monthlyRate: 0.6 }, { year: 2026, month: 11, monthlyRate: 0.41 }]);

        await updateIndexSeries(NOV_5);

        // Assim acompanha uma revisão do BCB e completa um mês que tenha faltado
        expect(fetchTaxaLegalSeries).toHaveBeenCalledWith(2024, 8, 2026, 11);
        expect(savedMonths('TAXA_LEGAL')).toEqual(['8/2024', '11/2026']);
    });

    it('duas atualizações ao mesmo tempo compartilham a mesma execução', async () => {
        const [a, b] = await Promise.all([updateIndexSeries(NOV_5), updateIndexSeries(NOV_5)]);

        expect(a).toBe(b);
        expect(fetchTaxaLegalSeries).toHaveBeenCalledTimes(1);
    });

    it('a carga das séries vazias não roda durante a atualização, que grava as mesmas séries', async () => {
        const update = updateIndexSeries(NOV_5);

        expect(await ensureIndexSeriesLoaded(NOV_5)).toEqual([]);
        await update;
        expect(prisma.indexSeries.createMany).not.toHaveBeenCalled();
    });

    it('a atualização espera a carga das séries vazias que estiver em andamento', async () => {
        let finishLoad!: () => void;
        (fetchTaxaLegalSeries as jest.Mock).mockImplementationOnce(() =>
            new Promise(resolve => { finishLoad = () => resolve([{ year: 2024, month: 8, monthlyRate: 0.6 }]); }));

        const load   = ensureIndexSeriesLoaded(NOV_5);   // a taxa legal está vazia: espera o BCB
        const update = updateIndexSeries(NOV_5);
        await new Promise(resolve => setImmediate(resolve));
        expect(fetchIndexSeries).not.toHaveBeenCalled();

        finishLoad();
        await Promise.all([load, update]);
        expect(prisma.indexSeries.createMany).toHaveBeenCalledTimes(1);
        expect(fetchIndexSeries).toHaveBeenCalled();
    });
});

describe('ensureIndexSeriesLoaded', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        lastStored = {};
        prisma.indexSeries.findFirst.mockImplementation(({ where }: any) => Promise.resolve(lastStored[where.indexName] ?? null));
        (fetchTaxaLegalSeries as jest.Mock).mockResolvedValue([{ year: 2024, month: 8, monthlyRate: 0.6 }]);
        (fetchTJPRSeries as jest.Mock).mockResolvedValue([]);
        (fetchTJMGSeries as jest.Mock).mockResolvedValue([{ year: 2000, month: 1, monthlyRate: 0.6 }]);
    });

    it('carrega só as séries que ainda não têm nenhum mês, desde o início de cada uma', async () => {
        lastStored = { TJPR_MEDIA_INPC_IGPDI: { year: 2026, month: 10 } };

        const results = await ensureIndexSeriesLoaded(NOV_5);

        expect(fetchTaxaLegalSeries).toHaveBeenCalledWith(2024, 8, 2026, 11);
        expect(fetchTJMGSeries).toHaveBeenCalledWith(2000, 1, 2026, 11);
        expect(fetchTJPRSeries).not.toHaveBeenCalled();
        expect(results).toEqual([{ indexName: 'TAXA_LEGAL', months: 1 }, { indexName: 'TJMG_CORREGEDORIA', months: 1 }]);
        expect(fetchIndexSeries).not.toHaveBeenCalled();
        // Cada série entra numa gravação só, para nenhum cálculo ver a série pela metade
        expect(prisma.indexSeries.createMany.mock.calls.map((c: any) => c[0].data)).toEqual([
            [{ indexName: 'TAXA_LEGAL', year: 2024, month: 8, monthlyRate: 0.6 }],
            [{ indexName: 'TJMG_CORREGEDORIA', year: 2000, month: 1, monthlyRate: 0.6 }],
        ]);
        expect(prisma.indexSeries.upsert).not.toHaveBeenCalled();
    });

    it('duas chamadas ao mesmo tempo compartilham a mesma carga, sem gravar a série duas vezes', async () => {
        lastStored = { TJPR_MEDIA_INPC_IGPDI: { year: 2026, month: 10 }, TJMG_CORREGEDORIA: { year: 2026, month: 11 } };

        const [a, b] = await Promise.all([ensureIndexSeriesLoaded(NOV_5), ensureIndexSeriesLoaded(NOV_5)]);

        expect(a).toBe(b);
        expect(fetchTaxaLegalSeries).toHaveBeenCalledTimes(1);
        expect(prisma.indexSeries.createMany).toHaveBeenCalledTimes(1);
    });

    it('com o PM2 em cluster, só a primeira instância carrega', async () => {
        process.env.NODE_APP_INSTANCE = '1';
        try {
            expect(await ensureIndexSeriesLoaded(NOV_5)).toEqual([]);
            expect(prisma.indexSeries.findFirst).not.toHaveBeenCalled();
        } finally {
            delete process.env.NODE_APP_INSTANCE;
        }
    });

    it('um erro do BCB fica no resultado, para o log mostrar', async () => {
        (fetchTaxaLegalSeries as jest.Mock).mockRejectedValue(new Error('BCB indisponível'));
        lastStored = { TJPR_MEDIA_INPC_IGPDI: { year: 2026, month: 10 }, TJMG_CORREGEDORIA: { year: 2026, month: 11 } };

        expect(await ensureIndexSeriesLoaded(NOV_5)).toEqual([{ indexName: 'TAXA_LEGAL', months: 0, error: 'BCB indisponível' }]);
    });

    it('com tudo carregado, não busca nada', async () => {
        lastStored = {
            TAXA_LEGAL:            { year: 2026, month: 11 },
            TJPR_MEDIA_INPC_IGPDI: { year: 2026, month: 10 },
            TJMG_CORREGEDORIA:     { year: 2026, month: 11 },
        };

        expect(await ensureIndexSeriesLoaded(NOV_5)).toEqual([]);
        expect(fetchTaxaLegalSeries).not.toHaveBeenCalled();
    });
});
