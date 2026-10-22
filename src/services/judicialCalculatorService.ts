/**
 * JudicialCalculatorService
 *
 * Suporta:
 *   - Parcelas de débito (tipo DEBITO), abatimentos/descontos (tipo ABATIMENTO) e custas ou
 *     despesas (tipo CUSTA)
 *   - Abatimentos corrigidos pelo mesmo índice até o mês de referência
 *   - Custas e despesas só corrigidas pelo índice, sem juros, multa nem honorários, e somadas no fim
 *   - 4 pontos de dedução: DO_VALOR_CORRIGIDO | APOS_HONORARIOS | APOS_MULTA | APOS_TUDO
 *   - Juros Moratórios: Taxa Legal (art.406/CC, Lei 14.905/2024), Taxa Legal + Tema 1368 do STJ
 *     ou Personalizado
 *   - Juros Remuneratórios: taxa adicional (compensatoryRate)
 *   - Índice NAO_ATUALIZAR ("Não atualizar (fixo)"): sem correção monetária
 *   - Opções "honorários sobre a multa" e "deflacionar", desmarcadas por padrão
 *
 * As convenções seguem o Dr. Calc (drcalc.net), a referência do escritório: a correção e os juros
 * contam do mês da parcela ao mês anterior ao de referência, um mês sem índice antes do início
 * ou no meio da série recusa o cálculo, e cada linha é arredondada em centavos antes de somar.
 */

import { prisma } from '../prisma';

/** "Não atualizar (fixo)": o principal não é corrigido; juros, multa e honorários seguem normais. */
export const NAO_ATUALIZAR = 'NAO_ATUALIZAR';

/** Taxa legal da Lei 14.905/2024 (Res. CMN 5.171/2024), série gravada pelo cron e pelo seed. */
export const TAXA_LEGAL = 'TAXA_LEGAL';

/**
 * Taxa legal + Tema 1368 do STJ: modo dos juros de mora e nome da série com a taxa de 03/1995 a
 * 07/2024, gravada pelo seed e pela carga das séries vazias.
 */
export const TAXA_LEGAL_TEMA1368 = 'TAXA_LEGAL_TEMA1368';

/** Modos dos juros de mora; o primeiro é o padrão. */
export const MORATORY_MODES = [TAXA_LEGAL, TAXA_LEGAL_TEMA1368, 'PERSONALIZADO'];

/** Tabela do TJSP: usa a razão entre os acumulados, então precisa também do mês da parcela. */
const TJSP = 'TJSP_LEI14905';

/** Tabelas de tribunal: a linha do mês M já traz o índice do mês anterior, como a tabela oficial. */
const COURT_TABLES = new Set([TJSP, 'TJPR_MEDIA_INPC_IGPDI', 'TJMG_CORREGEDORIA']);

/** Índices de correção que o cálculo aceita (a lista da tela fica em utils/indexOptions.ts do front). */
const CORRECTION_INDEXES = new Set([
    ...COURT_TABLES, 'IPCA_E', 'INPC', 'IPCA', 'IGP_M', 'SELIC', 'CDI_MENSAL', 'CDI_DIARIA', NAO_ATUALIZAR,
]);

/** Honorários do Art. 523, § 1º, do CPC: sempre 10%, como no Dr. Calc. */
const ART_523_FEES_PERCENTAGE = 10;

/**
 * Início do Real (01/07/1994). "Não atualizar (fixo)" vale a partir dele, como no Dr. Calc. Antes
 * dele, o fator da tabela do TJSP também converte a moeda antiga.
 */
const REAL_START = Date.UTC(1994, 6, 1);

/** O índice é um dos que o cálculo aceita? O salvamento dos parâmetros usa a mesma regra. */
export const isCorrectionIndex = (indexName: string) => CORRECTION_INDEXES.has(indexName);

export const unknownIndexError = (indexName: string) =>
    `índice de correção desconhecido (${indexName}). Escolha um índice da lista.`;

/**
 * Com "Não atualizar (fixo)", a mensagem de erro de uma parcela anterior ao Real (o valor estaria
 * em outra moeda e o Dr. Calc também recusa), ou null. O salvamento dos parâmetros usa a mesma regra.
 */
export function fixedIndexDateError(installments: { baseDate: string }[]): string | null {
    const early = installments.find(i => new Date(i.baseDate).getTime() < REAL_START);
    return early
        ? `"Não atualizar (fixo)" vale para datas a partir de 01/07/1994. Mude a data da parcela de ${formatDate(early.baseDate)} ou escolha outro índice.`
        : null;
}

/** Nome dos índices nas mensagens. */
const INDEX_LABELS: Record<string, string> = {
    TJSP_LEI14905:         'TJSP',
    TJPR_MEDIA_INPC_IGPDI: 'TJPR',
    TJMG_CORREGEDORIA:     'TJMG',
    IPCA_E:                'IPCA-E',
    IGP_M:                 'IGP-M',
    CDI_MENSAL:            'CDI',
    CDI_DIARIA:            'CDI',
    [TAXA_LEGAL]:          'taxa legal',
    [TAXA_LEGAL_TEMA1368]: 'taxa legal do Tema 1368',
};
const indexLabel = (indexName: string) => INDEX_LABELS[indexName] ?? indexName;

export type DeductionPoint = 'DO_VALOR_CORRIGIDO' | 'APOS_HONORARIOS' | 'APOS_MULTA' | 'APOS_TUDO';

/** DEBITO (padrão), ABATIMENTO (crédito ou pagamento) ou CUSTA (custa ou despesa, como no Dr. Calc). */
export type InstallmentType = 'DEBITO' | 'ABATIMENTO' | 'CUSTA';

export interface Installment {
    baseValue:      number;
    baseDate:       string; // ISO date string
    description?:   string;
    type?:          InstallmentType;           // default DEBITO
    deductionPoint?: DeductionPoint;           // only for ABATIMENTO, default APOS_TUDO
}

export interface CalculationParams {
    correctionIndex:          string;
    moratoryMode?:            string;  // "TAXA_LEGAL" (default) | "TAXA_LEGAL_TEMA1368" | "PERSONALIZADO"
    moratoryRate:             number;
    moratoryRateUnit?:        string;  // "AM" (default) | "AA"
    moratoryType:             string;  // "SIMPLES" | "COMPOSTO"
    moratoryStartDate?:       string | null;
    compensatoryRate:         number;
    compensatoryRateUnit?:    string;  // "AM" (default) | "AA"
    compensatoryType:         string;
    compensatoryStartDate?:   string | null;
    multaPercentage?:         number;
    feesMode?:                string;  // "PERCENTUAL" (default) | "FIXO"
    feesPercentage:           number;
    feesFixedValue?:          number;
    penaltyPercentage:        number;
    feesOnPenalty:            boolean;
    feesOnMulta?:             boolean; // honorários também sobre a multa (padrão: não, como no Dr. Calc)
    deflate?:                 boolean; // inflação negativa reduz o valor abaixo do nominal (padrão: não)
    installments:             Installment[];
}

export interface MonthBreakdown {
    year:        number;
    month:       number;
    monthlyRate: number;
    accumulated: number;
}

export interface InstallmentResult {
    installmentIndex:     number;
    description:          string;
    baseValue:            number;
    baseDate:             string;
    correctionFactor:     number;
    correctedValue:       number;
    moratoryMonths:       number;
    moratoryInterest:     number;
    compensatoryInterest: number;
    feesValue:            number;
    penaltyValue:         number;
    subtotal:             number;
    monthBreakdown:       MonthBreakdown[];
    nominalFloor?:        boolean;  // inflação negativa no período: o fator ficou em 1 (sem "deflacionar")
}

export interface AbatimentoResult {
    description:      string;
    baseDate:         string;
    baseValue:        number;
    correctionFactor: number;
    correctedValue:   number;   // valor atualizado até o mês de referência
    deductionPoint:   DeductionPoint;
}

/** Custa ou despesa: corrigida pelo índice do cálculo até o mês de referência e somada no fim. */
export interface CustaResult {
    description:      string;
    baseDate:         string;
    baseValue:        number;
    correctionFactor: number;
    correctedValue:   number;
}

export interface CalculationResult {
    referenceMonth:       number;
    referenceYear:        number;
    baseTotal:            number;
    correctedValue:       number;
    moratoryInterest:     number;
    compensatoryInterest: number;
    multaValue:           number;   // multa sobre o valor corrigido
    subtotalA:            number;   // corrected + moratory + compensatory + multa
    feesValue:            number;   // honorários principais
    subtotalB:            number;   // subtotalA + fees
    penaltyValue:         number;   // multa Art.523
    grossTotal:           number;   // antes dos abatimentos
    abatimentoResults:    AbatimentoResult[];
    abatimentoTotal:      number;   // total deduzido
    custaResults:         CustaResult[];
    custaTotal:           number;   // custas e despesas corrigidas, somadas no fim
    totalValue:           number;   // grossTotal − abatimentoTotal + custaTotal
    installmentResults:   InstallmentResult[];
    calculations?:        CalculationSummary[];   // só quando o processo tem mais de um cálculo
    warnings?:            string[];               // ex.: meses depois do último índice gravado (entraram como 0%)
}

/** Resumo de um dos cálculos de um processo com vários cálculos. */
export interface CalculationSummary {
    label:          string;
    baseTotal:      number;
    correctedValue: number;
    totalValue:     number;
}

// ── utilidades de data ────────────────────────────────────────────────────────

function parseYM(isoDate: string): { year: number; month: number } {
    const d = new Date(isoDate);
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

function monthsBetween(sy: number, sm: number, ey: number, em: number): number {
    return (ey - sy) * 12 + (em - sm);
}

function monthRange(sy: number, sm: number, ey: number, em: number): { year: number; month: number }[] {
    const months: { year: number; month: number }[] = [];
    let y = sy, m = sm;
    while (y < ey || (y === ey && m <= em)) {
        months.push({ year: y, month: m });
        m++;
        if (m > 12) { m = 1; y++; }
    }
    return months;
}

function shiftYM(year: number, month: number, delta: number): { year: number; month: number } {
    const total = year * 12 + (month - 1) + delta;
    return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const ymKey = (year: number, month: number) => `${year}-${pad2(month)}`;
const formatYM = (year: number, month: number) => `${pad2(month)}/${year}`;

function formatDate(isoDate: string): string {
    const d = new Date(isoDate);
    return `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

/**
 * Arredonda em `decimals` casas, com o meio para cima, como o Dr. Calc (1,025 → 1,03). O
 * toPrecision(15) desfaz o erro da representação binária: 1,025 fica guardado como 1,02499999...
 */
function roundTo(n: number, decimals: number): number {
    const scale  = 10 ** decimals;
    const scaled = Number((Math.abs(n) * scale).toPrecision(15));
    return Math.sign(n) * Math.round(scaled) / scale;
}

/** Arredonda em centavos. */
const round2 = (n: number) => roundTo(n, 2);

// Converte taxa a.a. ou a.d. para mensal
function toMonthlyRate(rate: number, unit: string | undefined, type: string): number {
    if (!rate || !unit || unit === 'AM') return rate;
    if (unit === 'AA') {
        return type === 'COMPOSTO'
            ? (Math.pow(1 + rate / 100, 1 / 12) - 1) * 100
            : rate / 12;
    }
    if (unit === 'AD') {
        // Diária → mensal usando 30 dias/mês como convenção
        return type === 'COMPOSTO'
            ? (Math.pow(1 + rate / 100, 30) - 1) * 100
            : rate * 30;
    }
    return rate;
}

// ── Taxa legal (art. 406 do CC, Lei 14.905/2024), como no Dr. Calc ───────────
//
// Juros simples sobre o valor corrigido, pelos meses do mês de início ao mês anterior ao de
// referência (a mesma janela dos juros com taxa fixa). A taxa de cada mês soma as taxas diárias:
//   - até 11/02/2003: 6% a.a. (Código Civil de 1916), 6%/365 por dia;
//   - de 12/02/2003 a 29/08/2024: 12% a.a. (Código Civil de 2002), 12%/365 por dia;
//   - a partir de 30/08/2024: a taxa legal do mês (série TAXA_LEGAL), dividida pelos dias do mês.
// As datas de troca são as do Dr. Calc, a referência do escritório. Como lá, o ano tem 365 dias
// também quando é bissexto, e a taxa somada de cada parcela fica com 6 casas (em %).

const DAY_MS          = 86_400_000;
const TWELVE_PCT_FROM = Date.UTC(2003, 1, 12);   // 12/02/2003
const LEGAL_RATE_FROM = Date.UTC(2024, 7, 30);   // 30/08/2024

/** Dias do mês em cada período da taxa legal. */
function legalRateDays(year: number, month: number) {
    const first = Date.UTC(year, month - 1, 1);
    const next  = Date.UTC(year, month, 1);
    const span  = (from: number, to: number) => Math.max(0, Math.min(next, to) - Math.max(first, from)) / DAY_MS;
    return {
        days:      (next - first) / DAY_MS,
        sixPct:    span(-Infinity, TWELVE_PCT_FROM),
        twelvePct: span(TWELVE_PCT_FROM, LEGAL_RATE_FROM),
        legalRate: span(LEGAL_RATE_FROM, Infinity),
    };
}

/** Meses dos juros pela taxa legal: do mês de início ao mês anterior ao de referência. */
function legalRateMonths(startYear: number, startMonth: number, refYear: number, refMonth: number) {
    const last = shiftYM(refYear, refMonth, -1);
    return monthRange(startYear, startMonth, last.year, last.month);
}

/** Soma das taxas (%) da taxa legal nos meses dos juros. */
function taxaLegalRate(months: { year: number; month: number }[], legalRates: Map<string, number>): number {
    let totalRate = 0;
    for (const { year, month } of months) {
        const d = legalRateDays(year, month);
        totalRate += d.sixPct * 6 / 365 + d.twelvePct * 12 / 365;
        if (d.legalRate > 0) totalRate += (legalRates.get(ymKey(year, month)) ?? 0) * d.legalRate / d.days;
    }
    return totalRate;
}

// ── Taxa legal + Tema 1368 do STJ, como no Dr. Calc ─────────────────────────────
//
// Antes da Lei 14.905, o STJ (Tema 1368) aplicou a SELIC como a taxa do art. 406 do Código Civil.
// Como o valor já é corrigido, a SELIC entra descontada da inflação, pela regra que a Lei 14.905
// adotou: a taxa do mês M é (1 + SELIC acumulada em M-1) / (1 + IPCA-E de M-1) − 1, nunca menor que
// zero. A série TAXA_LEGAL_TEMA1368 guarda essa taxa de 03/1995 a 07/2024, e a partir de 08/2024
// vale a taxa legal oficial do mês inteiro (série TAXA_LEGAL). Juros simples, pelos mesmos meses da
// taxa legal e com a taxa somada também em 6 casas. Antes de 03/1995 não há taxa: o mês fica sem
// juros, como no Dr. Calc, com um aviso.

const TEMA1368_FROM       = 1995 * 12 + 3;   // 03/1995
const OFFICIAL_LEGAL_FROM = 2024 * 12 + 8;   // 08/2024

/** Em que série está a taxa do mês: nenhuma (antes de 03/1995), a do Tema 1368 ou a taxa legal oficial. */
function tema1368Source(year: number, month: number): string | null {
    const n = year * 12 + month;
    return n >= OFFICIAL_LEGAL_FROM ? TAXA_LEGAL : n >= TEMA1368_FROM ? TAXA_LEGAL_TEMA1368 : null;
}

/** Soma das taxas (%) da taxa legal + Tema 1368 nos meses dos juros. */
function tema1368Rate(months: { year: number; month: number }[], rates: Map<string, Map<string, number>>): number {
    let totalRate = 0;
    for (const { year, month } of months) {
        const source = tema1368Source(year, month);
        if (source) totalRate += rates.get(source)?.get(ymKey(year, month)) ?? 0;
    }
    return totalRate;
}

// ── meses sem índice ──────────────────────────────────────────────────────────
//
// Como o Dr. Calc: um mês antes do início da série ou faltando no meio dela recusa o cálculo;
// um mês depois do último gravado (ainda não publicado ou não carregado) entra como 0% e vira um aviso.

type SeriesBounds = { first: number; last: number };   // ano * 12 + mês

const boundToYM = (n: number) => { const year = Math.floor((n - 1) / 12); return formatYM(year, n - year * 12); };

async function seriesBounds(indexName: string): Promise<SeriesBounds | null> {
    const select = { year: true, month: true } as const;
    const [first, last] = await Promise.all([
        prisma.indexSeries.findFirst({ where: { indexName }, orderBy: [{ year: 'asc' }, { month: 'asc' }], select }),
        prisma.indexSeries.findFirst({ where: { indexName }, orderBy: [{ year: 'desc' }, { month: 'desc' }], select }),
    ]);
    return first && last ? { first: first.year * 12 + first.month, last: last.year * 12 + last.month } : null;
}

function checkIndexMonths(
    indexName: string,
    months: { year: number; month: number }[],
    hasMonth: (key: string) => boolean,
    bounds: SeriesBounds | null,
    warnings: Set<string>,
): void {
    if (months.length === 0) return;
    const label = indexLabel(indexName);
    if (!bounds) throw new Error(`Não há dados de ${label} no banco de índices. Avise o suporte.`);

    for (const { year, month } of months) {
        if (hasMonth(ymKey(year, month))) continue;
        const n = year * 12 + month;
        // O limite é o do banco, não o do índice (o IPCA existe antes de 2000). As séries dos juros
        // começam numa data fixa (a taxa legal em 08/2024): um mês delas antes do primeiro gravado é
        // falta de dado. A do Tema 1368 também termina numa data fixa (07/2024)
        if (n < bounds.first && indexName !== TAXA_LEGAL && indexName !== TAXA_LEGAL_TEMA1368) {
            throw new Error(`O banco de índices tem ${label} só a partir de ${boundToYM(bounds.first)}, e o cálculo precisa de ${formatYM(year, month)}. Mude a data da parcela, escolha outro índice ou avise o suporte.`);
        }
        if (n <= bounds.last || indexName === TAXA_LEGAL_TEMA1368) {
            throw new Error(`Falta ${label} de ${formatYM(year, month)} no banco de índices. Avise o suporte.`);
        }
        warnings.add(`${label.charAt(0).toUpperCase() + label.slice(1)} de ${formatYM(year, month)} ainda sem valor no banco: o mês entrou como 0%.`);
    }
}

// ── helper: fator de correção para uma data base ──────────────────────────────
//
// Usa a inflação dos meses do mês da parcela ao mês anterior ao de referência, como o Dr. Calc.
// Nos índices de preço e de juros, a linha do mês M traz a variação do próprio mês: são as linhas
// desses meses. Nas tabelas de tribunal, a linha do mês M já traz o índice de M-1: são as linhas
// do mês seguinte à parcela até o de referência.
function correctionMonths(sy: number, sm: number, refYear: number, refMonth: number, courtTable: boolean) {
    const from = courtTable ? shiftYM(sy, sm, 1) : { year: sy, month: sm };
    const to   = courtTable ? { year: refYear, month: refMonth } : shiftYM(refYear, refMonth, -1);
    return monthRange(from.year, from.month, to.year, to.month);
}

// Num mês com o acumulado da tabela oficial (drcalc, estendido pelo cron), o fator vem da razão
// até o último acumulado anterior; nos outros, da taxa mensal. Com a tabela completa, o fator é
// acumulado(ref) / acumulado(base). Sem acumulado na referência (antes do cron do mês), vale a
// tabela até o último mês que a tem e a taxa mensal depois dele. A taxa mensal gravada nos meses
// da tabela não interfere: a do detalhamento vem do acumulado.
function computeFactor(
    sy: number, sm: number,
    refYear: number, refMonth: number,
    rateMap: Map<string, { monthlyRate: number; accumulatedValue: number | null }>,
    courtTable: boolean,
): { factor: number; breakdown: MonthBreakdown[] } {
    const corrMonths = correctionMonths(sy, sm, refYear, refMonth, courtTable);
    let lastAcc         = courtTable ? (rateMap.get(ymKey(sy, sm))?.accumulatedValue ?? null) : null;
    let factorAtLastAcc = 1;
    let factor          = 1;
    const breakdown: MonthBreakdown[] = [];

    for (const { year, month } of corrMonths) {
        const rec = rateMap.get(ymKey(year, month));
        let monthlyRate: number;
        if (rec?.accumulatedValue && lastAcc) {
            const next  = factorAtLastAcc * (rec.accumulatedValue / lastAcc);
            monthlyRate = (next / factor - 1) * 100;
            factor      = next;
        } else {
            monthlyRate = rec?.monthlyRate ?? 0;
            factor     *= 1 + monthlyRate / 100;
        }
        if (rec?.accumulatedValue) {
            lastAcc         = rec.accumulatedValue;
            factorAtLastAcc = factor;
        }
        breakdown.push({ year, month, monthlyRate, accumulated: factor });
    }
    return { factor, breakdown };
}

// ── engine principal ──────────────────────────────────────────────────────────

export async function calculateJudicialDebt(
    params: CalculationParams,
    referenceYear: number,
    referenceMonth: number,
): Promise<CalculationResult> {

    const allInstallments = params.installments;
    if (allInstallments.length === 0) throw new Error('Nenhuma parcela informada.');

    const debitoInstallments    = allInstallments.filter(i => (i.type ?? 'DEBITO') === 'DEBITO');
    const abatimentoInstallments = allInstallments.filter(i => i.type === 'ABATIMENTO');
    const custaInstallments      = allInstallments.filter(i => i.type === 'CUSTA');

    if (debitoInstallments.length === 0) throw new Error('Informe ao menos uma parcela de débito.');

    // Índice que a tela antiga gravava ("Outro", "IPCA15"): antes virava fator 1 sem aviso
    if (!isCorrectionIndex(params.correctionIndex)) {
        const message = unknownIndexError(params.correctionIndex);
        throw new Error(message.charAt(0).toUpperCase() + message.slice(1));
    }

    // 1. Busca índices do banco
    const sortedDebito  = [...debitoInstallments].sort((a, b) => new Date(a.baseDate).getTime() - new Date(b.baseDate).getTime());
    // As custas também são corrigidas: os meses delas entram na busca e na conferência dos índices
    const allSorted     = [...debitoInstallments, ...abatimentoInstallments, ...custaInstallments]
        .sort((a, b) => new Date(a.baseDate).getTime() - new Date(b.baseDate).getTime());
    const globalStart   = parseYM(allSorted[0].baseDate);
    const fetchRange    = monthRange(globalStart.year, globalStart.month, referenceYear, referenceMonth);

    // "Não atualizar (fixo)" não tem série: o fator é 1 e não há detalhamento mês a mês
    const isFixed    = params.correctionIndex === NAO_ATUALIZAR;
    const courtTable = COURT_TABLES.has(params.correctionIndex);
    const warnings   = new Set<string>();

    // Antes do Real, o valor estaria em outra moeda: o Dr. Calc recusa, e aqui também
    const fixedDateError = isFixed ? fixedIndexDateError(allSorted) : null;
    if (fixedDateError) throw new Error(fixedDateError);

    const indexRecords = isFixed ? [] : await prisma.indexSeries.findMany({
        where: { indexName: params.correctionIndex, OR: fetchRange.map(({ year, month }) => ({ year, month })) },
    });

    const rateMap = new Map<string, { monthlyRate: number; accumulatedValue: number | null }>();
    for (const rec of indexRecords) {
        rateMap.set(ymKey(rec.year, rec.month), {
            monthlyRate:     rec.monthlyRate,
            accumulatedValue: rec.accumulatedValue ?? null,
        });
    }

    // A parcela mais antiga usa todos os meses de que as outras precisam. Com a tabela oficial do
    // TJSP, o fator divide pelo acumulado do mês da parcela, que então também precisa existir; com
    // a série só de taxas, ou sem nenhum mês de correção (parcela no mês de referência ou depois),
    // o mês da parcela não entra na conta
    if (!isFixed) {
        const months   = correctionMonths(globalStart.year, globalStart.month, referenceYear, referenceMonth, courtTable);
        const firstRow = months.length > 0 ? rateMap.get(ymKey(months[0].year, months[0].month)) : undefined;
        if (params.correctionIndex === TJSP && firstRow?.accumulatedValue) months.unshift(globalStart);
        checkIndexMonths(params.correctionIndex, months, key => rateMap.has(key), await seriesBounds(params.correctionIndex), warnings);
    }

    // Sem "deflacionar", a inflação negativa não deixa o valor abaixo do nominal: o fator de cada
    // parcela, abatimento ou custa é no mínimo 1 (vale o acumulado, não cada mês), como no Dr. Calc.
    // Antes do Real, o fator da tabela do TJSP também converte a moeda e fica como está
    const factorFor = (baseDate: string): { factor: number; breakdown: MonthBreakdown[]; nominalFloor: boolean } => {
        const { year: sy, month: sm } = parseYM(baseDate);
        const result = isFixed ? { factor: 1, breakdown: [] } : computeFactor(sy, sm, referenceYear, referenceMonth, rateMap, courtTable);
        const nominalFloor = !params.deflate && result.factor < 1 && new Date(baseDate).getTime() >= REAL_START;
        return { ...result, factor: nominalFloor ? 1 : result.factor, nominalFloor };
    };

    // Como no Dr. Calc, a data da correção é o último dia do mês de referência: a parcela com data
    // nele ou depois é "a vencer" e fica sem multa
    const multaCutoff = Date.UTC(referenceYear, referenceMonth, 0);

    // Juros de mora pela taxa legal, com ou sem o Tema 1368: as taxas de cada série. Na taxa legal,
    // a série só é necessária a partir de 30/08/2024; no Tema 1368, a partir de 03/1995
    const moratoryMode  = params.moratoryMode ?? TAXA_LEGAL;
    const legalRateMode = moratoryMode === TAXA_LEGAL || moratoryMode === TAXA_LEGAL_TEMA1368;
    const moratoryRates = new Map<string, Map<string, number>>();
    if (legalRateMode) {
        const earliest = params.moratoryStartDate ? parseYM(params.moratoryStartDate) : parseYM(sortedDebito[0].baseDate);
        const months   = legalRateMonths(earliest.year, earliest.month, referenceYear, referenceMonth);
        const bySeries = new Map<string, { year: number; month: number }[]>();
        for (const m of months) {
            const source = moratoryMode === TAXA_LEGAL
                ? (legalRateDays(m.year, m.month).legalRate > 0 ? TAXA_LEGAL : null)
                : tema1368Source(m.year, m.month);
            if (!source) continue;
            if (!bySeries.has(source)) bySeries.set(source, []);
            bySeries.get(source)!.push(m);
        }
        for (const [indexName, seriesMonths] of bySeries) {
            const rows = await prisma.indexSeries.findMany({
                where: { indexName, OR: seriesMonths.map(({ year, month }) => ({ year, month })) },
            });
            const rates = new Map<string, number>(rows.map(r => [ymKey(r.year, r.month), r.monthlyRate]));
            moratoryRates.set(indexName, rates);
            checkIndexMonths(indexName, seriesMonths, key => rates.has(key), await seriesBounds(indexName), warnings);
        }
        if (moratoryMode === TAXA_LEGAL_TEMA1368 && months.some(m => !tema1368Source(m.year, m.month))) {
            warnings.add('A taxa legal do Tema 1368 começa em 03/1995: os meses anteriores ficaram sem juros de mora, como no Dr. Calc.');
        }
    }

    // 2. Processa parcelas de DÉBITO
    const installmentResults: InstallmentResult[] = [];
    let totalBase         = 0;
    let totalCorrected    = 0;
    let totalMoratory     = 0;
    let totalCompensatory = 0;
    let multaBase         = 0;   // valor corrigido das parcelas já vencidas

    // Converte taxas a.a. → a.m. uma única vez antes do loop
    const effectiveMoratoryRate     = toMonthlyRate(params.moratoryRate,     params.moratoryRateUnit,     params.moratoryType);
    const effectiveCompensatoryRate = toMonthlyRate(params.compensatoryRate, params.compensatoryRateUnit, params.compensatoryType);

    for (let i = 0; i < debitoInstallments.length; i++) {
        const inst = debitoInstallments[i];
        const { year: sy, month: sm } = parseYM(inst.baseDate);
        const { factor, breakdown, nominalFloor } = factorFor(inst.baseDate);
        // Cada linha é arredondada em centavos, e os juros correm sobre o valor corrigido já
        // arredondado, como no Dr. Calc
        const correctedValue = round2(inst.baseValue * factor);
        if (new Date(inst.baseDate).getTime() < multaCutoff) multaBase += correctedValue;

        const moratoryStart = params.moratoryStartDate ? parseYM(params.moratoryStartDate) : { year: sy, month: sm };
        let moratoryInterest = 0, nMoratory = 0;

        if (legalRateMode) {
            const months = legalRateMonths(moratoryStart.year, moratoryStart.month, referenceYear, referenceMonth);
            const rate   = moratoryMode === TAXA_LEGAL
                ? taxaLegalRate(months, moratoryRates.get(TAXA_LEGAL) ?? new Map())
                : tema1368Rate(months, moratoryRates);
            // A taxa somada da parcela fica com 6 casas (em %), como no Dr. Calc
            moratoryInterest = round2(correctedValue * roundTo(rate, 6) / 100);
            nMoratory = months.length;
        } else {
            nMoratory = Math.max(0, monthsBetween(moratoryStart.year, moratoryStart.month, referenceYear, referenceMonth));
            if (effectiveMoratoryRate > 0 && nMoratory > 0) {
                moratoryInterest = round2(params.moratoryType === 'SIMPLES'
                    ? correctedValue * (effectiveMoratoryRate / 100) * nMoratory
                    : correctedValue * (Math.pow(1 + effectiveMoratoryRate / 100, nMoratory) - 1));
            }
        }

        let compensatoryInterest = 0;
        if (effectiveCompensatoryRate > 0) {
            const compStart = params.compensatoryStartDate
                ? parseYM(params.compensatoryStartDate)
                : { year: sy, month: sm };
            const nComp = Math.max(0, monthsBetween(compStart.year, compStart.month, referenceYear, referenceMonth));
            if (nComp > 0) {
                compensatoryInterest = round2(params.compensatoryType === 'SIMPLES'
                    ? correctedValue * (effectiveCompensatoryRate / 100) * nComp
                    : correctedValue * (Math.pow(1 + effectiveCompensatoryRate / 100, nComp) - 1));
            }
        }

        installmentResults.push({
            installmentIndex:     i + 1,
            description:          inst.description || `Parcela ${i + 1}`,
            baseValue:            inst.baseValue,
            baseDate:             inst.baseDate,
            correctionFactor:     parseFloat(factor.toFixed(8)),
            correctedValue,
            moratoryMonths:       nMoratory,
            moratoryInterest,
            compensatoryInterest,
            feesValue:            0, // calculado no agregado
            penaltyValue:         0,
            subtotal:             round2(correctedValue + moratoryInterest + compensatoryInterest),
            monthBreakdown:       breakdown,
            ...(nominalFloor ? { nominalFloor: true } : {}),
        });

        totalBase         += inst.baseValue;
        totalCorrected    += correctedValue;
        totalMoratory     += moratoryInterest;
        totalCompensatory += compensatoryInterest;
    }

    // 3. Processa ABATIMENTOS — corrigi cada um pelo mesmo índice
    const abatimentoResults: AbatimentoResult[] = [];
    for (const abat of abatimentoInstallments) {
        const { factor } = factorFor(abat.baseDate);
        const correctedDeduction = abat.baseValue * factor;
        abatimentoResults.push({
            description:      abat.description || 'Abatimento',
            baseDate:         abat.baseDate,
            baseValue:        abat.baseValue,
            correctionFactor: parseFloat(factor.toFixed(8)),
            correctedValue:   round2(correctedDeduction),
            deductionPoint:   abat.deductionPoint ?? 'APOS_TUDO',
        });
    }

    function deductAt(point: DeductionPoint): number {
        return abatimentoResults.filter(a => a.deductionPoint === point).reduce((s, a) => s + a.correctedValue, 0);
    }

    // 4. Aplica deduções em cascata. Os totais somam as linhas já arredondadas, e a multa, os
    // honorários e o Art. 523 são arredondados sobre eles, como no Dr. Calc
    const correctedSum    = round2(totalCorrected);
    const moratorySum     = round2(totalMoratory);
    const compensatorySum = round2(totalCompensatory);
    // A multa incide sobre o total corrigido das parcelas já vencidas, e não sobre a multa de cada
    // linha arredondada (no Dr. Calc, a multa por linha é só exibição)
    const multaValue      = round2(round2(multaBase) * ((params.multaPercentage ?? 0) / 100));
    const grossSubtotalA  = round2(correctedSum + moratorySum + compensatorySum + multaValue);

    // DO_VALOR_CORRIGIDO — reduz a base antes dos honorários
    const effectiveSubtotalA = round2(grossSubtotalA - deductAt('DO_VALOR_CORRIGIDO'));

    // Os honorários só incidem sobre a multa com a opção marcada (o padrão do Dr. Calc é não incidir)
    const feesBase    = params.feesOnMulta ? effectiveSubtotalA : round2(effectiveSubtotalA - multaValue);
    const isFeesFixed = params.feesMode === 'FIXO';
    const feesValue   = isFeesFixed
        ? round2(params.feesFixedValue ?? 0)
        : round2(feesBase * (params.feesPercentage / 100));
    const subtotalB   = round2(effectiveSubtotalA + feesValue);

    // APOS_HONORARIOS — antes de Art.523
    const effectiveSubtotalB = round2(subtotalB - deductAt('APOS_HONORARIOS'));

    // Art. 523, § 1º, do CPC: a multa e os honorários de 10% incidem sobre o débito já com os
    // honorários da condenação, mesmo quando eles são um valor fixo (como no Dr. Calc). No campo
    // único da tela, 20% são a multa e os honorários: cada 10% é uma linha arredondada, como lá
    const penaltyMulta       = Math.min(params.penaltyPercentage, ART_523_FEES_PERCENTAGE);
    const penaltyValue       = round2(round2(effectiveSubtotalB * (penaltyMulta / 100))
        + round2(effectiveSubtotalB * ((params.penaltyPercentage - penaltyMulta) / 100)));
    const feesOnPenaltyValue = params.feesOnPenalty ? round2(effectiveSubtotalB * (ART_523_FEES_PERCENTAGE / 100)) : 0;
    const afterArt523        = round2(effectiveSubtotalB + penaltyValue + feesOnPenaltyValue);

    // APOS_MULTA — após Art.523 completo
    const afterMultaDed = round2(afterArt523 - deductAt('APOS_MULTA'));

    // APOS_TUDO — após tudo
    const afterDeductions = round2(afterMultaDed - deductAt('APOS_TUDO'));

    // 5. Custas e despesas, como no Dr. Calc: só a correção monetária, pelo mesmo índice e a partir
    // da data de cada uma, sem juros, multa nem honorários (nem os do Art. 523), somadas no fim
    const custaResults: CustaResult[] = custaInstallments.map(custa => {
        const { factor } = factorFor(custa.baseDate);
        return {
            description:      custa.description || 'Custa ou despesa',
            baseDate:         custa.baseDate,
            baseValue:        custa.baseValue,
            correctionFactor: parseFloat(factor.toFixed(8)),
            correctedValue:   round2(custa.baseValue * factor),
        };
    });
    const custaTotal = round2(custaResults.reduce((s, c) => s + c.correctedValue, 0));
    const finalTotal = afterDeductions + custaTotal;

    const abatimentoTotal = abatimentoResults.reduce((s, a) => s + a.correctedValue, 0);

    return {
        referenceMonth,
        referenceYear,
        baseTotal:            round2(totalBase),
        correctedValue:       correctedSum,
        moratoryInterest:     moratorySum,
        compensatoryInterest: compensatorySum,
        multaValue,
        subtotalA:            grossSubtotalA,
        feesValue:            round2(feesValue + feesOnPenaltyValue),
        subtotalB,
        penaltyValue,
        grossTotal:           afterArt523,
        abatimentoResults,
        abatimentoTotal:      round2(abatimentoTotal),
        custaResults,
        custaTotal,
        totalValue:           round2(finalTotal),
        installmentResults,
        ...(warnings.size > 0 ? { warnings: [...warnings] } : {}),
    };
}

// ── vários cálculos no mesmo processo ─────────────────────────────────────────

/**
 * Junta os resultados de vários cálculos do mesmo processo (ex.: dois contratos com índices
 * ou juros diferentes). Cada cálculo é feito por inteiro, com os próprios honorários e
 * multas, e os valores são somados, como se fossem cálculos separados. As parcelas, os
 * abatimentos e as custas levam o nome do cálculo na descrição. Com um cálculo só, nada muda.
 */
export function combineResults(parts: { label: string; result: CalculationResult }[]): CalculationResult {
    if (parts.length === 1) return parts[0].result;

    const sum = (pick: (r: CalculationResult) => number) =>
        round2(parts.reduce((total, p) => total + pick(p.result), 0));

    const installmentResults: InstallmentResult[] = [];
    const abatimentoResults: AbatimentoResult[] = [];
    const custaResults: CustaResult[] = [];
    for (const { label, result } of parts) {
        for (const inst of result.installmentResults) {
            installmentResults.push({
                ...inst,
                installmentIndex: installmentResults.length + 1,
                description:      `${label} · ${inst.description}`,
            });
        }
        for (const abat of result.abatimentoResults) {
            abatimentoResults.push({ ...abat, description: `${label} · ${abat.description}` });
        }
        for (const custa of result.custaResults) {
            custaResults.push({ ...custa, description: `${label} · ${custa.description}` });
        }
    }
    const warnings = parts.flatMap(({ label, result }) => (result.warnings ?? []).map(w => `${label}: ${w}`));

    return {
        referenceMonth:       parts[0].result.referenceMonth,
        referenceYear:        parts[0].result.referenceYear,
        baseTotal:            sum(r => r.baseTotal),
        correctedValue:       sum(r => r.correctedValue),
        moratoryInterest:     sum(r => r.moratoryInterest),
        compensatoryInterest: sum(r => r.compensatoryInterest),
        multaValue:           sum(r => r.multaValue),
        subtotalA:            sum(r => r.subtotalA),
        feesValue:            sum(r => r.feesValue),
        subtotalB:            sum(r => r.subtotalB),
        penaltyValue:         sum(r => r.penaltyValue),
        grossTotal:           sum(r => r.grossTotal),
        abatimentoResults,
        abatimentoTotal:      sum(r => r.abatimentoTotal),
        custaResults,
        custaTotal:           sum(r => r.custaTotal),
        totalValue:           sum(r => r.totalValue),
        installmentResults,
        calculations: parts.map(({ label, result }) => ({
            label,
            baseTotal:      result.baseTotal,
            correctedValue: result.correctedValue,
            totalValue:     result.totalValue,
        })),
        ...(warnings.length > 0 ? { warnings } : {}),
    };
}
