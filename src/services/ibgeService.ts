/**
 * IBGEService — busca séries de índices econômicos na API pública do IBGE
 *
 * Séries utilizadas:
 *   IPCA-E  : código 10764
 *   INPC    : código 188
 *   IPCA-15 : código 13522
 *   IPCA    : código 433
 */

import axios from 'axios';

const IBGE_BASE = 'https://servicodados.ibge.gov.br/api/v3/agregados';

// Mapeamento: nome interno → código da série IBGE
const SERIES_CODES: Record<string, string> = {
    IPCA_E:  '10764',
    INPC:    '188',
    IPCA15:  '13522',
    IPCA:    '433',
};

export interface IBGEDataPoint {
    year: number;
    month: number;
    monthlyRate: number; // variação % do mês
}

/**
 * Busca a variação mensal de um índice entre duas datas.
 * @param indexName Nome interno ("IPCA_E", "INPC", "IPCA15")
 * @param startYear  Ano inicial (inclusive)
 * @param startMonth Mês inicial (1-12, inclusive)
 * @param endYear    Ano final (inclusive, default = ano atual)
 * @param endMonth   Mês final (1-12, inclusive, default = mês atual)
 */
export async function fetchIndexSeries(
    indexName: string,
    startYear: number,
    startMonth: number,
    endYear?: number,
    endMonth?: number,
): Promise<IBGEDataPoint[]> {
    const seriesCode = SERIES_CODES[indexName];
    if (!seriesCode) throw new Error(`Índice desconhecido: ${indexName}`);

    const now = new Date();
    const eYear  = endYear  ?? now.getFullYear();
    const eMonth = endMonth ?? now.getMonth() + 1;

    const startPeriod = `${startYear}${String(startMonth).padStart(2, '0')}`;
    const endPeriod   = `${eYear}${String(eMonth).padStart(2, '0')}`;

    // Endpoint: /agregados/{codigo}/periodos/{inicio}|{fim}/variaveis/2266
    // Variável 2266 = variação mensal
    const url = `${IBGE_BASE}/${seriesCode}/periodos/${startPeriod}|${endPeriod}/variaveis/2266?localidades=N1[all]`;

    const response = await axios.get(url, { timeout: 15000 });
    const resultados = response.data?.[0]?.resultados?.[0]?.series?.[0]?.serie;

    if (!resultados) throw new Error(`Sem dados do IBGE para ${indexName}`);

    const points: IBGEDataPoint[] = [];
    for (const [period, value] of Object.entries(resultados)) {
        const year  = parseInt(period.substring(0, 4), 10);
        const month = parseInt(period.substring(4, 6), 10);
        const rate  = parseFloat(value as string);
        if (!isNaN(rate)) points.push({ year, month, monthlyRate: rate });
    }

    return points.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
}

/**
 * Para o índice TJSP_LEI14905:
 *   - Antes de jan/2024: usa IPCA-15 (índice adotado pelo TJ/SP)
 *   - A partir de jan/2024 (Lei 14905/2024): usa IPCA-E
 *
 * Monta a série híbrida completa.
 */
export async function fetchTJSPSeries(
    startYear: number,
    startMonth: number,
    endYear?: number,
    endMonth?: number,
): Promise<IBGEDataPoint[]> {
    const now = new Date();
    const eYear  = endYear  ?? now.getFullYear();
    const eMonth = endMonth ?? now.getMonth() + 1;

    const parts: IBGEDataPoint[] = [];

    // Parte 1: IPCA-15 até dez/2023
    const cutoffYear  = 2024;
    const cutoffMonth = 1;

    const ipca15End = eYear < cutoffYear || (eYear === cutoffYear && eMonth < cutoffMonth)
        ? { y: eYear, m: eMonth }
        : { y: 2023, m: 12 };

    if (startYear < cutoffYear || (startYear === cutoffYear && startMonth < cutoffMonth)) {
        const ipca15 = await fetchIndexSeries('IPCA15', startYear, startMonth, ipca15End.y, ipca15End.m);
        parts.push(...ipca15.map(p => ({ ...p })));
    }

    // Parte 2: IPCA-E a partir de jan/2024
    if (eYear > 2023 || (eYear === 2024 && eMonth >= 1)) {
        const ipcaEStart = startYear > 2023 ? { y: startYear, m: startMonth } : { y: 2024, m: 1 };
        const ipcaE = await fetchIndexSeries('IPCA_E', ipcaEStart.y, ipcaEStart.m, eYear, eMonth);
        parts.push(...ipcaE.map(p => ({ ...p })));
    }

    return parts.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
}
