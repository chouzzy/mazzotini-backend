/**
 * IndexService — busca séries de índices via API do Banco Central do Brasil (BCB/SGS)
 *
 * Séries utilizadas:
 *   IPCA-E  : 10764  (variação mensal, %)
 *   INPC    : 188    (variação mensal, %)
 *   IPCA    : 433    (variação mensal, %)
 *   IPCA-15 : 7478   (variação mensal, %) — base da tabela do TJSP desde set/2024
 *   SELIC   : 11     (meta SELIC, % a.a.) — convertida para mensal no fetchSelicSeries
 */

import axios from 'axios';

const BCB_BASE = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs';

const SERIES_CODES: Record<string, number> = {
    IPCA_E:     10764,
    INPC:       188,
    IPCA:       433,
    IPCA_15:    7478,   // IPCA-15 variação mensal % (usado na tabela do TJSP)
    IGP_M:      189,    // IGP-M variação mensal %
    CDI_MENSAL: 4391,   // CDI acumulado no mês %
    // SELIC e CDI_DIARIA: série 11 / 12 (taxa diária "over", % a.d.) — acumulação mensal feita em fetchSelicSeries/fetchCDIDiariaSereis
};

export interface IBGEDataPoint {
    year: number;
    month: number;
    monthlyRate: number;
}

function formatDateBCB(year: number, month: number): string {
    return `01/${String(month).padStart(2, '0')}/${year}`;
}

// O SGS do BCB às vezes responde 5xx ou demora demais. Como o cron roda uma vez por mês,
// um índice que falha fica um mês sem atualizar: vale tentar de novo antes de desistir.
const RETRY_DELAYS_MS = [2000, 5000, 15000];

async function getBCB(url: string, timeout: number): Promise<{ data: string; valor: string }[]> {
    for (let attempt = 0; ; attempt++) {
        try {
            const response = await axios.get<{ data: string; valor: string }[]>(url, { timeout });
            return response.data;
        } catch (err: any) {
            const status = err?.response?.status;
            // Erro 4xx (ex.: 404 de período ainda sem dado publicado) não melhora repetindo
            const transient = !status || status >= 500;
            if (!transient || attempt >= RETRY_DELAYS_MS.length) throw err;
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
        }
    }
}

/**
 * Busca variação mensal de um índice via API do Banco Central.
 */
export async function fetchIndexSeries(
    indexName: string,
    startYear: number,
    startMonth: number,
    endYear?: number,
    endMonth?: number,
): Promise<IBGEDataPoint[]> {
    const code = SERIES_CODES[indexName];
    if (!code) throw new Error(`Índice desconhecido: ${indexName}`);

    const now   = new Date();
    const eYear  = endYear  ?? now.getFullYear();
    const eMonth = endMonth ?? now.getMonth() + 1;

    const startDate = formatDateBCB(startYear, startMonth);
    const endDate   = formatDateBCB(eYear, eMonth);

    const url = `${BCB_BASE}.${code}/dados?formato=json&dataInicial=${startDate}&dataFinal=${endDate}`;

    const data = await getBCB(url, 20000);

    if (!Array.isArray(data) || data.length === 0) {
        throw new Error(`Sem dados do BCB para ${indexName}`);
    }

    const points: IBGEDataPoint[] = [];
    for (const item of data) {
        // data format: "dd/MM/yyyy"
        const parts = item.data.split('/');
        const month = parseInt(parts[1], 10);
        const year  = parseInt(parts[2], 10);
        const rate  = parseFloat(item.valor.replace(',', '.'));
        if (!isNaN(rate)) points.push({ year, month, monthlyRate: rate });
    }

    return points.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
}

/**
 * SELIC mensal com precisão máxima — acumula taxas DIÁRIAS da série 11 (% a.d.).
 *
 * A série 4390 publica o mensal com 2 casas decimais (ex: 0.84%).
 * A série 11 publica a taxa diária "over" com 6 casas (ex: 0.039270%).
 * Acumulando dia a dia: ∏(1 + taxa_diária/100) - 1
 * Isso elimina o erro de arredondamento mensal.
 */
export async function fetchSelicSeries(
    startYear: number,
    startMonth: number,
    endYear?: number,
    endMonth?: number,
): Promise<IBGEDataPoint[]> {
    const now    = new Date();
    const eYear  = endYear  ?? now.getFullYear();
    const eMonth = endMonth ?? now.getMonth() + 1;

    // Último dia do mês final (garante todos os dias úteis)
    const lastDay = new Date(eYear, eMonth, 0).getDate();
    const endDate = `${String(lastDay).padStart(2, '0')}/${String(eMonth).padStart(2, '0')}/${eYear}`;

    const url = `${BCB_BASE}.11/dados?formato=json&dataInicial=${formatDateBCB(startYear, startMonth)}&dataFinal=${endDate}`;
    const data = await getBCB(url, 60000);

    if (!Array.isArray(data) || data.length === 0) throw new Error('Sem dados SELIC diários do BCB (série 11)');

    // Acumula produto diário por mês
    const monthMap = new Map<string, number>();
    for (const item of data) {
        const parts     = item.data.split('/');
        const month     = parseInt(parts[1], 10);
        const year      = parseInt(parts[2], 10);
        const dailyRate = parseFloat(item.valor.replace(',', '.'));
        if (isNaN(dailyRate)) continue;
        const key = `${year}-${month}`;
        monthMap.set(key, (monthMap.get(key) ?? 1) * (1 + dailyRate / 100));
    }

    const points: IBGEDataPoint[] = [];
    for (const [key, product] of monthMap.entries()) {
        const [year, month] = key.split('-').map(Number);
        const monthlyRate   = parseFloat(((product - 1) * 100).toFixed(6));
        points.push({ year, month, monthlyRate });
    }
    return points.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
}

/**
 * CDI Diária — acumula taxas DIÁRIAS da série BCB 12 (% a.d.) em produto mensal.
 * Mesma lógica da SELIC (série 11), mas usando a série CDI over (série 12).
 */
export async function fetchCDIDiariaSeries(
    startYear: number,
    startMonth: number,
    endYear?: number,
    endMonth?: number,
): Promise<IBGEDataPoint[]> {
    const now    = new Date();
    const eYear  = endYear  ?? now.getFullYear();
    const eMonth = endMonth ?? now.getMonth() + 1;

    const lastDay = new Date(eYear, eMonth, 0).getDate();
    const endDate = `${String(lastDay).padStart(2, '0')}/${String(eMonth).padStart(2, '0')}/${eYear}`;

    const url = `${BCB_BASE}.12/dados?formato=json&dataInicial=${formatDateBCB(startYear, startMonth)}&dataFinal=${endDate}`;
    const data = await getBCB(url, 60000);

    if (!Array.isArray(data) || data.length === 0) throw new Error('Sem dados CDI diários do BCB (série 12)');

    const monthMap = new Map<string, number>();
    for (const item of data) {
        const parts     = item.data.split('/');
        const month     = parseInt(parts[1], 10);
        const year      = parseInt(parts[2], 10);
        const dailyRate = parseFloat(item.valor.replace(',', '.'));
        if (isNaN(dailyRate)) continue;
        const key = `${year}-${month}`;
        monthMap.set(key, (monthMap.get(key) ?? 1) * (1 + dailyRate / 100));
    }

    const points: IBGEDataPoint[] = [];
    for (const [key, product] of monthMap.entries()) {
        const [year, month] = key.split('-').map(Number);
        const monthlyRate   = parseFloat(((product - 1) * 100).toFixed(6));
        points.push({ year, month, monthlyRate });
    }
    return points.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
    const total = year * 12 + (month - 1) + delta;
    return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

/**
 * Índice TJSP_LEI14905 (tabela prática do TJ/SP para débitos judiciais).
 * A taxa da tabela no mês M é a variação do índice no mês M-1:
 *   - tabela até ago/2024 : INPC do mês anterior     (série BCB 188)
 *   - tabela set/2024+    : IPCA-15 do mês anterior  (série BCB 7478, Lei 14.905/2024)
 * Conferido mês a mês contra a tabela do drcalc (src/scripts/data/tjsp-accumulated.json).
 * Os pontos retornados já vêm no mês da tabela.
 */
export async function fetchTJSPSeries(
    startYear: number,
    startMonth: number,
    endYear?: number,
    endMonth?: number,
): Promise<IBGEDataPoint[]> {
    const now    = new Date();
    const eYear  = endYear  ?? now.getFullYear();
    const eMonth = endMonth ?? now.getMonth() + 1;

    // Meses de origem do índice: um mês antes dos meses da tabela
    const srcStart = shiftMonth(startYear, startMonth, -1);
    const srcEnd   = shiftMonth(eYear, eMonth, -1);
    const parts: IBGEDataPoint[] = [];

    // Parte 1: INPC de origem até jul/2024 (tabela até ago/2024)
    if (srcStart.year < 2024 || (srcStart.year === 2024 && srcStart.month <= 7)) {
        const inpcEnd = (srcEnd.year < 2024 || (srcEnd.year === 2024 && srcEnd.month <= 7))
            ? srcEnd
            : { year: 2024, month: 7 };
        const inpc = await fetchIndexSeries('INPC', srcStart.year, srcStart.month, inpcEnd.year, inpcEnd.month);
        parts.push(...inpc);
    }

    // Parte 2: IPCA-15 de origem a partir de ago/2024 (tabela a partir de set/2024)
    if (srcEnd.year > 2024 || (srcEnd.year === 2024 && srcEnd.month >= 8)) {
        const ipca15Start = (srcStart.year > 2024 || (srcStart.year === 2024 && srcStart.month >= 8))
            ? srcStart
            : { year: 2024, month: 8 };
        const ipca15 = await fetchIndexSeries('IPCA_15', ipca15Start.year, ipca15Start.month, srcEnd.year, srcEnd.month);
        parts.push(...ipca15);
    }

    return parts
        .map(p => ({ ...shiftMonth(p.year, p.month, 1), monthlyRate: p.monthlyRate }))
        .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
}
