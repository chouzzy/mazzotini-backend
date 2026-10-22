/**
 * Atualização dos índices da calculadora (IndexSeries), chamada todo dia pelo cron das 6h e pelo
 * recálculo do dia 5.
 *
 * - IPCA_E, INPC, IPCA e IGP_M: do último mês gravado (inclusive) até o mês atual. O BCB só
 *   devolve os meses publicados: o IPCA de um mês sai por volta do dia 10 do mês seguinte.
 * - CDI e SELIC: do último mês gravado até o mês anterior. As taxas são diárias e o BCB
 *   publica o mês corrente parcial; regravar o último mês completa um mês que entrou parcial.
 * - TJSP_LEI14905: estende a tabela oficial (acumulado) a partir do último mês que a tem.
 * - TJPR_MEDIA_INPC_IGPDI e TJMG_CORREGEDORIA: do último mês gravado até o mês atual. A taxa
 *   do mês M usa os índices de M-1, então o mês entra quando eles saem.
 * - TAXA_LEGAL: a série inteira, desde 08/2024, a cada execução (são poucos meses): acompanha uma
 *   revisão do BCB e completa um mês que tenha faltado. A taxa do mês M usa a SELIC e o IPCA-15
 *   de M-1, que saem no começo do mês.
 * - TAXA_LEGAL_TEMA1368 não entra aqui: é histórica (03/1995 a 07/2024) e só é carregada quando está
 *   vazia, por ensureIndexSeriesLoaded ou pelo seed.
 *
 * Um mês que ainda não saiu entra na próxima execução, e um índice com erro não impede os outros.
 */

import { prisma } from '../prisma';
import {
    fetchIndexSeries, fetchSelicSeries, fetchTaxaLegalSeries, fetchTaxaLegalTema1368Series, fetchTJMGSeries,
    fetchTJPRSeries, fetchTJSPSeries, IBGEDataPoint, shiftMonth,
} from './ibgeService';

type YearMonth = { year: number; month: number };

export interface IndexUpdateResult {
    indexName: string;
    months:    number;
    error?:    string;
}

const TJSP = 'TJSP_LEI14905';

// Índices que o BCB só publica com o mês fechado
const MONTHLY_INDEXES = ['IPCA_E', 'INPC', 'IPCA', 'IGP_M'];

// Tabelas de tribunal montadas com os índices do mês anterior
const COURT_TABLES: { indexName: string; fetchTable: typeof fetchTJPRSeries }[] = [
    { indexName: 'TJPR_MEDIA_INPC_IGPDI', fetchTable: fetchTJPRSeries },
    { indexName: 'TJMG_CORREGEDORIA',     fetchTable: fetchTJMGSeries },
];

// Taxa legal da Lei 14.905/2024, a partir de 30/08/2024 (o mês de agosto entra pelos dois últimos dias)
const TAXA_LEGAL = 'TAXA_LEGAL';

// Taxa legal + Tema 1368 do STJ, de 03/1995 a 07/2024 (353 meses)
const TAXA_LEGAL_TEMA1368 = 'TAXA_LEGAL_TEMA1368';
const TAXA_LEGAL_TEMA1368_MONTHS = 353;

// Início usado quando o índice ainda não tem nenhum mês gravado (o mesmo do seed)
const DEFAULT_START: YearMonth       = { year: 2000, month: 1 };
const SELIC_DEFAULT_START: YearMonth = { year: 2024, month: 1 };
const TAXA_LEGAL_START: YearMonth    = { year: 2024, month: 8 };

const isAfter = (a: YearMonth, b: YearMonth) => a.year * 12 + a.month > b.year * 12 + b.month;
const formatMonth = (p: YearMonth) => `${String(p.month).padStart(2, '0')}/${p.year}`;

/** Só a primeira instância do PM2 em cluster atualiza os índices (sem cluster, é a única). */
export const isFirstInstance = () => (process.env.NODE_APP_INSTANCE ?? '0') === '0';

/**
 * Atualização em andamento. Chamadas ao mesmo tempo compartilham a mesma, e a carga das séries
 * vazias não roda enquanto ela grava as mesmas séries.
 */
let updating: Promise<IndexUpdateResult[]> | null = null;

export function updateIndexSeries(now = new Date()): Promise<IndexUpdateResult[]> {
    if (!updating) {
        updating = (async () => {
            // Uma carga das séries vazias em andamento termina antes
            await loadingEmptySeries?.catch(() => undefined);
            return updateAllSeries(now);
        })().finally(() => { updating = null; });
    }
    return updating;
}

async function updateAllSeries(now: Date): Promise<IndexUpdateResult[]> {
    const current: YearMonth   = { year: now.getFullYear(), month: now.getMonth() + 1 };
    const lastMonth: YearMonth = shiftMonth(current.year, current.month, -1);
    const results: IndexUpdateResult[] = [];

    for (const indexName of MONTHLY_INDEXES) {
        results.push(await run(indexName, () => refresh(indexName, DEFAULT_START, current,
            (s, e) => fetchIndexSeries(indexName, s.year, s.month, e.year, e.month))));
    }

    // CDI_DIARIA usa a mesma série do CDI_MENSAL, como no seed, mas a partir do próprio
    // último mês: assim um mês que falte em um dos dois não fica para trás
    for (const indexName of ['CDI_MENSAL', 'CDI_DIARIA']) {
        results.push(await run(indexName, () => refresh(indexName, DEFAULT_START, lastMonth,
            (s, e) => fetchIndexSeries('CDI_MENSAL', s.year, s.month, e.year, e.month))));
    }

    // SELIC: índice de correção da calculadora (a taxa legal tem a própria série, TAXA_LEGAL)
    results.push(await run('SELIC', () => refresh('SELIC', SELIC_DEFAULT_START, lastMonth,
        (s, e) => fetchSelicSeries(s.year, s.month, e.year, e.month))));

    results.push(await run(TJSP, () => updateTJSPSeries(current)));

    for (const { indexName, fetchTable } of COURT_TABLES) {
        results.push(await run(indexName, () => refresh(indexName, DEFAULT_START, current,
            (s, e) => fetchTable(s.year, s.month, e.year, e.month))));
    }

    results.push(await run(TAXA_LEGAL, async () => {
        const points = await fetchTaxaLegalSeries(TAXA_LEGAL_START.year, TAXA_LEGAL_START.month, current.year, current.month);
        await upsertMonthlyRates(TAXA_LEGAL, points);
        return points;
    }));

    return results;
}

/**
 * Carrega as séries que o cálculo exige e que podem estar vazias depois de um deploy: a taxa
 * legal e a taxa legal + Tema 1368 (séries novas) e as tabelas do TJPR e do TJMG (quando o seed
 * não rodou). Só busca as que não têm nenhum mês gravado; as outras seguem pelo cron do dia 5. A do
 * Tema 1368, que é histórica e tem tamanho fixo, também é completada quando está pela metade (uma
 * carga interrompida), já que o cron não a busca. Roda no início do servidor e a cada hora, então
 * um BCB fora do ar no deploy se resolve sozinho.
 *
 * Cada série entra de uma vez (um createMany), e não mês a mês: um cálculo que rode durante a
 * carga quase sempre vê a série vazia ou inteira. Não é uma transação, então sobra uma janela de
 * milissegundos. Com o PM2 em cluster, só a primeira instância carrega; chamadas ao mesmo tempo (o
 * início do servidor e o cron de hora em hora) compartilham a mesma carga, e a carga não roda
 * enquanto a atualização completa, que também grava essas séries, estiver em andamento.
 */
let loadingEmptySeries: Promise<IndexUpdateResult[]> | null = null;

export function ensureIndexSeriesLoaded(now = new Date()): Promise<IndexUpdateResult[]> {
    if (!isFirstInstance() || updating) return Promise.resolve([]);
    if (!loadingEmptySeries) {
        loadingEmptySeries = loadEmptySeries(now).finally(() => { loadingEmptySeries = null; });
    }
    return loadingEmptySeries;
}

async function loadEmptySeries(now: Date): Promise<IndexUpdateResult[]> {
    const current: YearMonth = { year: now.getFullYear(), month: now.getMonth() + 1 };
    const series: { indexName: string; fetchSeries: () => Promise<IBGEDataPoint[]>; months?: number }[] = [
        { indexName: TAXA_LEGAL, fetchSeries: () => fetchTaxaLegalSeries(TAXA_LEGAL_START.year, TAXA_LEGAL_START.month, current.year, current.month) },
        { indexName: TAXA_LEGAL_TEMA1368, fetchSeries: fetchTaxaLegalTema1368Series, months: TAXA_LEGAL_TEMA1368_MONTHS },
        ...COURT_TABLES.map(t => ({
            indexName:   t.indexName,
            fetchSeries: () => t.fetchTable(DEFAULT_START.year, DEFAULT_START.month, current.year, current.month),
        })),
    ];
    const results: IndexUpdateResult[] = [];

    for (const { indexName, fetchSeries, months } of series) {
        // Série de tamanho fixo: conta os meses; as outras só são carregadas quando vazias
        const stored = months ? await prisma.indexSeries.count({ where: { indexName } }) : (await lastStoredMonth(indexName) ? 1 : 0);
        if (stored >= (months ?? 1)) continue;
        results.push(await run(indexName, async () => {
            const points = await fetchSeries();
            if (points.length === 0) return points;
            if (stored === 0) {
                await prisma.indexSeries.createMany({
                    data: points.map(p => ({ indexName, year: p.year, month: p.month, monthlyRate: p.monthlyRate })),
                });
            } else {
                // Pela metade: completa sem apagar o que já está gravado
                await upsertMonthlyRates(indexName, points);
            }
            return points;
        }));
    }
    return results;
}

/** Resumo de uma carga para o log: "TAXA_LEGAL (27 meses), TJPR_MEDIA_INPC_IGPDI (erro: ...)". */
export function describeIndexLoad(results: IndexUpdateResult[]): string {
    return results
        .map(r => r.error ? `${r.indexName} (erro: ${r.error})` : `${r.indexName} (${r.months} ${r.months === 1 ? 'mês' : 'meses'})`)
        .join(', ');
}

/** Busca do último mês gravado (ou de `defaultStart`) até `end` e grava as taxas. */
async function refresh(
    indexName: string,
    defaultStart: YearMonth,
    end: YearMonth,
    fetch: (start: YearMonth, end: YearMonth) => Promise<IBGEDataPoint[]>,
): Promise<IBGEDataPoint[]> {
    const start = (await lastStoredMonth(indexName)) ?? defaultStart;
    if (isAfter(start, end)) return [];
    const points = await fetch(start, end);
    await upsertMonthlyRates(indexName, points);
    return points;
}

/**
 * Estende a tabela do TJSP a partir do último mês com acumulado (importado do drcalc ou
 * gravado aqui): acumulado(M) = acumulado(M-1) × (1 + taxa(M)/100). Assim o cálculo segue
 * usando a razão entre acumulados, como a tabela oficial. Meses com acumulado não são alterados.
 */
async function updateTJSPSeries(current: YearMonth): Promise<IBGEDataPoint[]> {
    const lastOfficial = await prisma.indexSeries.findFirst({
        where:   { indexName: TJSP, accumulatedValue: { gt: 0 } },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    // Sem a tabela oficial: grava só as taxas, sempre desde o início. Recomeçar do último mês
    // gravado deixaria os meses anteriores com a regra antiga do seed (índice do próprio mês)
    // e contaria o mês da emenda duas vezes.
    if (!lastOfficial?.accumulatedValue) {
        const points = await fetchTJSPSeries(DEFAULT_START.year, DEFAULT_START.month, current.year, current.month);
        await upsertMonthlyRates(TJSP, points);
        return points;
    }

    const start = shiftMonth(lastOfficial.year, lastOfficial.month, 1);
    if (isAfter(start, current)) return [];

    const points = await fetchTJSPSeries(start.year, start.month, current.year, current.month);
    let accumulated = lastOfficial.accumulatedValue;
    let expected    = start;
    const saved: IBGEDataPoint[] = [];

    for (const p of points) {
        // Um mês faltando quebra a sequência: o resto entra na próxima execução
        if (p.year !== expected.year || p.month !== expected.month) break;
        accumulated = accumulated * (1 + p.monthlyRate / 100);
        await prisma.indexSeries.upsert({
            where:  { indexName_year_month: { indexName: TJSP, year: p.year, month: p.month } },
            create: { indexName: TJSP, year: p.year, month: p.month, monthlyRate: p.monthlyRate, accumulatedValue: accumulated },
            update: { monthlyRate: p.monthlyRate, accumulatedValue: accumulated },
        });
        expected = shiftMonth(expected.year, expected.month, 1);
        saved.push(p);
    }
    return saved;
}

async function lastStoredMonth(indexName: string): Promise<YearMonth | null> {
    const last = await prisma.indexSeries.findFirst({
        where:   { indexName },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        select:  { year: true, month: true },
    });
    return last ? { year: last.year, month: last.month } : null;
}

async function upsertMonthlyRates(indexName: string, points: IBGEDataPoint[]) {
    for (const p of points) {
        await prisma.indexSeries.upsert({
            where:  { indexName_year_month: { indexName, year: p.year, month: p.month } },
            create: { indexName, year: p.year, month: p.month, monthlyRate: p.monthlyRate },
            update: { monthlyRate: p.monthlyRate },
        });
    }
}

/** Roda a atualização de um índice e registra no log os meses gravados ou o erro. */
async function run(indexName: string, job: () => Promise<IBGEDataPoint[]>): Promise<IndexUpdateResult> {
    try {
        const points = await job();
        const months = points.length;
        const range  = months > 0 ? ` (${formatMonth(points[0])} a ${formatMonth(points[months - 1])})` : '';
        console.log(`  Índice ${indexName}: ${months} ${months === 1 ? 'mês gravado' : 'meses gravados'}${range}`);
        return { indexName, months };
    } catch (e: any) {
        const message = e?.message ?? String(e);
        console.error(`  Erro ao atualizar ${indexName}:`, message);
        return { indexName, months: 0, error: message };
    }
}
