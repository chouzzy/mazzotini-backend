/**
 * Atualização mensal dos índices da calculadora (IndexSeries), chamada pelo cron do dia 5.
 *
 * Cada índice é buscado a partir do último mês já gravado (inclusive, para completar um mês
 * que tenha entrado parcial) até o mês atual. O BCB só devolve os meses já publicados: o IPCA
 * de um mês, por exemplo, sai por volta do dia 10 do mês seguinte. Um mês que ainda não saiu
 * entra na próxima execução.
 */

import { prisma } from '../prisma';
import { fetchIndexSeries, fetchSelicSeries, fetchTJSPSeries, IBGEDataPoint, shiftMonth } from './ibgeService';

type YearMonth = { year: number; month: number };

export interface IndexUpdateResult {
    indexName: string;
    months:    number;
    error?:    string;
}

const TJSP = 'TJSP_LEI14905';

// Índices que o BCB só publica com o mês fechado
const MONTHLY_INDEXES = ['IPCA_E', 'INPC', 'IPCA', 'IGP_M'];

// Início usado só quando o índice ainda não tem nenhum mês gravado (o mesmo do seed)
const DEFAULT_START: YearMonth       = { year: 2000, month: 1 };
const SELIC_DEFAULT_START: YearMonth = { year: 2024, month: 1 };

const isAfter = (a: YearMonth, b: YearMonth) => a.year * 12 + a.month > b.year * 12 + b.month;

export async function updateIndexSeries(now = new Date()): Promise<IndexUpdateResult[]> {
    const current: YearMonth   = { year: now.getFullYear(), month: now.getMonth() + 1 };
    const lastMonth: YearMonth = shiftMonth(current.year, current.month, -1);
    const results: IndexUpdateResult[] = [];

    for (const indexName of MONTHLY_INDEXES) {
        results.push(await run(indexName, async () => {
            const points = await refresh(indexName, DEFAULT_START, current,
                (s, e) => fetchIndexSeries(indexName, s.year, s.month, e.year, e.month));
            return points.length;
        }));
    }

    // CDI e SELIC acumulam taxas diárias e o BCB publica o mês corrente parcial,
    // então só entram meses completos
    results.push(await run('CDI_MENSAL', async () => {
        const points = await refresh('CDI_MENSAL', DEFAULT_START, lastMonth,
            (s, e) => fetchIndexSeries('CDI_MENSAL', s.year, s.month, e.year, e.month));
        // CDI_DIARIA espelha o CDI_MENSAL, como no seed
        await upsertMonthlyRates('CDI_DIARIA', points);
        return points.length;
    }));

    // SELIC: usada pela taxa legal desde set/2024
    results.push(await run('SELIC', async () => {
        const points = await refresh('SELIC', SELIC_DEFAULT_START, lastMonth,
            (s, e) => fetchSelicSeries(s.year, s.month, e.year, e.month));
        return points.length;
    }));

    results.push(await run(TJSP, () => updateTJSPSeries(current)));

    return results;
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
async function updateTJSPSeries(current: YearMonth): Promise<number> {
    const lastOfficial = await prisma.indexSeries.findFirst({
        where:   { indexName: TJSP, accumulatedValue: { gt: 0 } },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    // Sem a tabela oficial importada: grava só as taxas, como nos outros índices
    if (!lastOfficial?.accumulatedValue) {
        const start  = (await lastStoredMonth(TJSP)) ?? DEFAULT_START;
        const points = await fetchTJSPSeries(start.year, start.month, current.year, current.month);
        await upsertMonthlyRates(TJSP, points);
        return points.length;
    }

    const start = shiftMonth(lastOfficial.year, lastOfficial.month, 1);
    if (isAfter(start, current)) return 0;

    const points = await fetchTJSPSeries(start.year, start.month, current.year, current.month);
    let accumulated = lastOfficial.accumulatedValue;
    let expected    = start;
    let saved       = 0;

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
        saved++;
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

/** Um índice com erro não impede os outros. */
async function run(indexName: string, job: () => Promise<number>): Promise<IndexUpdateResult> {
    try {
        const months = await job();
        console.log(`  Índice ${indexName} atualizado: ${months} meses`);
        return { indexName, months };
    } catch (e: any) {
        console.error(`  Erro ao atualizar ${indexName}:`, e.message);
        return { indexName, months: 0, error: e.message };
    }
}
