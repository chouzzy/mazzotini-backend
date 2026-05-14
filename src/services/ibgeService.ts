/**
 * IndexService — busca séries de índices via API do Banco Central do Brasil (BCB/SGS)
 *
 * Séries utilizadas:
 *   IPCA-E  : 10764  (variação mensal, %)
 *   INPC    : 188    (variação mensal, %)
 *   IPCA    : 433    (variação mensal, %)
 *   SELIC   : 11     (meta SELIC, % a.a.) — convertida para mensal no fetchSelicSeries
 */

import axios from 'axios';

const BCB_BASE = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs';

const SERIES_CODES: Record<string, number> = {
    IPCA_E: 10764,
    INPC:   188,
    IPCA:   433,
    SELIC:  4390, // Selic acumulada no mês (% a.a.) — requer conversão para mensal
};

export interface IBGEDataPoint {
    year: number;
    month: number;
    monthlyRate: number;
}

function formatDateBCB(year: number, month: number): string {
    return `01/${String(month).padStart(2, '0')}/${year}`;
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

    const response = await axios.get<{ data: string; valor: string }[]>(url, { timeout: 20000 });
    const data = response.data;

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
 * Meta SELIC (BCB série 11) — retorna variação MENSAL efetiva.
 * A série 11 publica % a.a.; cada valor é convertido por:
 *   mensal = ((1 + aa/100)^(1/12) - 1) × 100
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
    const code   = SERIES_CODES['SELIC'];

    const url = `${BCB_BASE}.${code}/dados?formato=json&dataInicial=${formatDateBCB(startYear, startMonth)}&dataFinal=${formatDateBCB(eYear, eMonth)}`;
    const response = await axios.get<{ data: string; valor: string }[]>(url, { timeout: 20000 });
    const data = response.data;

    if (!Array.isArray(data) || data.length === 0) throw new Error('Sem dados SELIC do BCB');

    // Série 4390 já retorna % mensal diretamente (ex: 0.84 = 0,84%/mês)
    const points: IBGEDataPoint[] = [];
    for (const item of data) {
        const parts = item.data.split('/');
        const month = parseInt(parts[1], 10);
        const year  = parseInt(parts[2], 10);
        const rate  = parseFloat(item.valor.replace(',', '.'));
        if (isNaN(rate)) continue;
        points.push({ year, month, monthlyRate: rate });
    }
    return points.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
}

/**
 * Índice TJSP_LEI14905 (TJ/SP Débitos Judiciais):
 *   - até ago/2024  : INPC  (série BCB 188)
 *   - set/2024+     : IPCA  (série BCB 433, conforme Lei 14905/2024)
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

    const parts: IBGEDataPoint[] = [];

    // Parte 1: INPC até ago/2024
    const inpcEnd = (eYear < 2024 || (eYear === 2024 && eMonth <= 8))
        ? { y: eYear, m: eMonth }
        : { y: 2024, m: 8 };

    if (startYear < 2024 || (startYear === 2024 && startMonth <= 8)) {
        const inpc = await fetchIndexSeries('INPC', startYear, startMonth, inpcEnd.y, inpcEnd.m);
        parts.push(...inpc);
    }

    // Parte 2: IPCA a partir de set/2024
    if (eYear > 2024 || (eYear === 2024 && eMonth >= 9)) {
        const ipcaStart = (startYear > 2024 || (startYear === 2024 && startMonth >= 9))
            ? { y: startYear, m: startMonth }
            : { y: 2024, m: 9 };
        const ipca = await fetchIndexSeries('IPCA', ipcaStart.y, ipcaStart.m, eYear, eMonth);
        parts.push(...ipca);
    }

    return parts.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
}
