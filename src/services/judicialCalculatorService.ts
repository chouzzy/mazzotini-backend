/**
 * JudicialCalculatorService
 *
 * Suporta:
 *   - Parcelas de débito (tipo DEBITO) e abatimentos/descontos (tipo ABATIMENTO)
 *   - Abatimentos corrigidos pelo mesmo índice até o mês de referência
 *   - 4 pontos de dedução: DO_VALOR_CORRIGIDO | APOS_HONORARIOS | APOS_MULTA | APOS_TUDO
 *   - Juros Moratórios: Taxa Legal (art.406/CC, Lei 14.905/2024) ou Personalizado
 *   - Juros Remuneratórios: taxa adicional (compensatoryRate)
 *   - Índice NAO_ATUALIZAR ("Não atualizar (fixo)"): sem correção monetária
 *
 * As convenções seguem o Dr. Calc (drcalc.net), a referência do escritório: a correção e os juros
 * contam do mês da parcela ao mês anterior ao de referência, e um mês sem índice antes do início
 * ou no meio da série recusa o cálculo.
 */

import { prisma } from '../prisma';

/** "Não atualizar (fixo)": o principal não é corrigido; juros, multa e honorários seguem normais. */
export const NAO_ATUALIZAR = 'NAO_ATUALIZAR';

/** Taxa legal da Lei 14.905/2024 (Res. CMN 5.171/2024), série gravada pelo cron e pelo seed. */
export const TAXA_LEGAL = 'TAXA_LEGAL';

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

/** "Não atualizar (fixo)" vale a partir do Real (01/07/1994), como no Dr. Calc. */
const FIXED_INDEX_START = Date.UTC(1994, 6, 1);

/** O índice é um dos que o cálculo aceita? O salvamento dos parâmetros usa a mesma regra. */
export const isCorrectionIndex = (indexName: string) => CORRECTION_INDEXES.has(indexName);

export const unknownIndexError = (indexName: string) =>
    `índice de correção desconhecido (${indexName}). Escolha um índice da lista.`;

/**
 * Com "Não atualizar (fixo)", a mensagem de erro de uma parcela anterior ao Real (o valor estaria
 * em outra moeda e o Dr. Calc também recusa), ou null. O salvamento dos parâmetros usa a mesma regra.
 */
export function fixedIndexDateError(installments: { baseDate: string }[]): string | null {
    const early = installments.find(i => new Date(i.baseDate).getTime() < FIXED_INDEX_START);
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
};
const indexLabel = (indexName: string) => INDEX_LABELS[indexName] ?? indexName;

export type DeductionPoint = 'DO_VALOR_CORRIGIDO' | 'APOS_HONORARIOS' | 'APOS_MULTA' | 'APOS_TUDO';

export interface Installment {
    baseValue:      number;
    baseDate:       string; // ISO date string
    description?:   string;
    type?:          'DEBITO' | 'ABATIMENTO';  // default DEBITO
    deductionPoint?: DeductionPoint;           // only for ABATIMENTO, default APOS_TUDO
}

export interface CalculationParams {
    correctionIndex:          string;
    moratoryMode?:            string;  // "TAXA_LEGAL" (default) | "PERSONALIZADO"
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
}

export interface AbatimentoResult {
    description:      string;
    baseDate:         string;
    baseValue:        number;
    correctionFactor: number;
    correctedValue:   number;   // valor atualizado até o mês de referência
    deductionPoint:   DeductionPoint;
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
    totalValue:           number;   // grossTotal − abatimentoTotal
    installmentResults:   InstallmentResult[];
    calculations?:        CalculationSummary[];   // só quando o processo tem mais de um cálculo
    warnings?:            string[];               // meses depois do último índice gravado (entraram como 0%)
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

function round2(n: number): number { return Math.round(n * 100) / 100; }

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
// As datas de troca são as do Dr. Calc, a referência do escritório.

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

function computeTaxaLegalMoratory(
    correctedValue: number,
    startYear: number, startMonth: number,
    refYear: number,   refMonth: number,
    legalRates: Map<string, number>,
): { interest: number; months: number } {
    const months = legalRateMonths(startYear, startMonth, refYear, refMonth);
    let totalRate = 0;
    for (const { year, month } of months) {
        const d = legalRateDays(year, month);
        totalRate += d.sixPct * 6 / 365 + d.twelvePct * 12 / 365;
        if (d.legalRate > 0) totalRate += (legalRates.get(ymKey(year, month)) ?? 0) * d.legalRate / d.days;
    }
    return { interest: correctedValue * totalRate / 100, months: months.length };
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
        // O limite é o do banco, não o do índice (o IPCA existe antes de 2000). A taxa legal começa
        // em 08/2024 por definição: um mês dela antes do primeiro gravado é falta de dado
        if (n < bounds.first && indexName !== TAXA_LEGAL) {
            throw new Error(`O banco de índices tem ${label} só a partir de ${boundToYM(bounds.first)}, e o cálculo precisa de ${formatYM(year, month)}. Mude a data da parcela, escolha outro índice ou avise o suporte.`);
        }
        if (n <= bounds.last) {
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

    if (debitoInstallments.length === 0) throw new Error('Informe ao menos uma parcela de débito.');

    // Índice que a tela antiga gravava ("Outro", "IPCA15"): antes virava fator 1 sem aviso
    if (!isCorrectionIndex(params.correctionIndex)) {
        const message = unknownIndexError(params.correctionIndex);
        throw new Error(message.charAt(0).toUpperCase() + message.slice(1));
    }

    // 1. Busca índices do banco
    const sortedDebito  = [...debitoInstallments].sort((a, b) => new Date(a.baseDate).getTime() - new Date(b.baseDate).getTime());
    const sortedAbat    = [...abatimentoInstallments].sort((a, b) => new Date(a.baseDate).getTime() - new Date(b.baseDate).getTime());
    const allSorted     = [...sortedDebito, ...sortedAbat].sort((a, b) => new Date(a.baseDate).getTime() - new Date(b.baseDate).getTime());
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

    const factorFor = (sy: number, sm: number): { factor: number; breakdown: MonthBreakdown[] } =>
        isFixed ? { factor: 1, breakdown: [] } : computeFactor(sy, sm, referenceYear, referenceMonth, rateMap, courtTable);

    // Taxa legal dos juros de mora: a série só é necessária a partir de 30/08/2024
    const usesLegalRate = (params.moratoryMode ?? 'TAXA_LEGAL') === 'TAXA_LEGAL';
    const legalRates    = new Map<string, number>();
    if (usesLegalRate) {
        const earliest = params.moratoryStartDate ? parseYM(params.moratoryStartDate) : parseYM(sortedDebito[0].baseDate);
        const months   = legalRateMonths(earliest.year, earliest.month, referenceYear, referenceMonth)
            .filter(({ year, month }) => legalRateDays(year, month).legalRate > 0);
        if (months.length > 0) {
            const rows = await prisma.indexSeries.findMany({
                where: { indexName: TAXA_LEGAL, OR: months.map(({ year, month }) => ({ year, month })) },
            });
            for (const row of rows) legalRates.set(ymKey(row.year, row.month), row.monthlyRate);
            checkIndexMonths(TAXA_LEGAL, months, key => legalRates.has(key), await seriesBounds(TAXA_LEGAL), warnings);
        }
    }

    // 2. Processa parcelas de DÉBITO
    const installmentResults: InstallmentResult[] = [];
    let totalBase         = 0;
    let totalCorrected    = 0;
    let totalMoratory     = 0;
    let totalCompensatory = 0;

    // Converte taxas a.a. → a.m. uma única vez antes do loop
    const effectiveMoratoryRate     = toMonthlyRate(params.moratoryRate,     params.moratoryRateUnit,     params.moratoryType);
    const effectiveCompensatoryRate = toMonthlyRate(params.compensatoryRate, params.compensatoryRateUnit, params.compensatoryType);

    for (let i = 0; i < debitoInstallments.length; i++) {
        const inst = debitoInstallments[i];
        const { year: sy, month: sm } = parseYM(inst.baseDate);
        const { factor, breakdown } = factorFor(sy, sm);
        const correctedValue = inst.baseValue * factor;

        const moratoryStart = params.moratoryStartDate ? parseYM(params.moratoryStartDate) : { year: sy, month: sm };
        let moratoryInterest = 0, nMoratory = 0;

        if (usesLegalRate) {
            const ml = computeTaxaLegalMoratory(correctedValue, moratoryStart.year, moratoryStart.month, referenceYear, referenceMonth, legalRates);
            moratoryInterest = ml.interest;
            nMoratory = ml.months;
        } else {
            nMoratory = Math.max(0, monthsBetween(moratoryStart.year, moratoryStart.month, referenceYear, referenceMonth));
            if (effectiveMoratoryRate > 0 && nMoratory > 0) {
                moratoryInterest = params.moratoryType === 'SIMPLES'
                    ? correctedValue * (effectiveMoratoryRate / 100) * nMoratory
                    : correctedValue * (Math.pow(1 + effectiveMoratoryRate / 100, nMoratory) - 1);
            }
        }

        let compensatoryInterest = 0;
        if (effectiveCompensatoryRate > 0) {
            const compStart = params.compensatoryStartDate
                ? parseYM(params.compensatoryStartDate)
                : { year: sy, month: sm };
            const nComp = Math.max(0, monthsBetween(compStart.year, compStart.month, referenceYear, referenceMonth));
            if (nComp > 0) {
                compensatoryInterest = params.compensatoryType === 'SIMPLES'
                    ? correctedValue * (effectiveCompensatoryRate / 100) * nComp
                    : correctedValue * (Math.pow(1 + effectiveCompensatoryRate / 100, nComp) - 1);
            }
        }

        const subtotalA = correctedValue + moratoryInterest + compensatoryInterest;
        installmentResults.push({
            installmentIndex:     i + 1,
            description:          inst.description || `Parcela ${i + 1}`,
            baseValue:            inst.baseValue,
            baseDate:             inst.baseDate,
            correctionFactor:     parseFloat(factor.toFixed(8)),
            correctedValue:       round2(correctedValue),
            moratoryMonths:       nMoratory,
            moratoryInterest:     round2(moratoryInterest),
            compensatoryInterest: round2(compensatoryInterest),
            feesValue:            0, // calculado no agregado
            penaltyValue:         0,
            subtotal:             round2(subtotalA),
            monthBreakdown:       breakdown,
        });

        totalBase         += inst.baseValue;
        totalCorrected    += correctedValue;
        totalMoratory     += moratoryInterest;
        totalCompensatory += compensatoryInterest;
    }

    // 3. Processa ABATIMENTOS — corrigi cada um pelo mesmo índice
    const abatimentoResults: AbatimentoResult[] = [];
    for (const abat of abatimentoInstallments) {
        const { year: sy, month: sm } = parseYM(abat.baseDate);
        const { factor } = factorFor(sy, sm);
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

    // 4. Aplica deduções em cascata
    const multaValue     = totalCorrected * ((params.multaPercentage ?? 0) / 100);
    const grossSubtotalA = totalCorrected + totalMoratory + totalCompensatory + multaValue;

    // DO_VALOR_CORRIGIDO — reduz a base antes dos honorários
    const effectiveSubtotalA = grossSubtotalA - deductAt('DO_VALOR_CORRIGIDO');

    const isFeesFixed = params.feesMode === 'FIXO';
    const feesValue   = isFeesFixed
        ? (params.feesFixedValue ?? 0)
        : effectiveSubtotalA * (params.feesPercentage / 100);
    const subtotalB   = effectiveSubtotalA + feesValue;

    // APOS_HONORARIOS — antes de Art.523
    const effectiveSubtotalB = subtotalB - deductAt('APOS_HONORARIOS');

    // Art. 523, § 1º, do CPC: a multa e os honorários de 10% incidem sobre o débito já com os
    // honorários da condenação, mesmo quando eles são um valor fixo (como no Dr. Calc)
    const penaltyValue       = effectiveSubtotalB * (params.penaltyPercentage / 100);
    const feesOnPenaltyValue = params.feesOnPenalty ? effectiveSubtotalB * (ART_523_FEES_PERCENTAGE / 100) : 0;
    const afterArt523        = effectiveSubtotalB + penaltyValue + feesOnPenaltyValue;

    // APOS_MULTA — após Art.523 completo
    const afterMultaDed = afterArt523 - deductAt('APOS_MULTA');

    // APOS_TUDO — após tudo
    const finalTotal = afterMultaDed - deductAt('APOS_TUDO');

    const abatimentoTotal = abatimentoResults.reduce((s, a) => s + a.correctedValue, 0);

    return {
        referenceMonth,
        referenceYear,
        baseTotal:            round2(totalBase),
        correctedValue:       round2(totalCorrected),
        moratoryInterest:     round2(totalMoratory),
        compensatoryInterest: round2(totalCompensatory),
        multaValue:           round2(multaValue),
        subtotalA:            round2(grossSubtotalA),
        feesValue:            round2(feesValue + feesOnPenaltyValue),
        subtotalB:            round2(subtotalB),
        penaltyValue:         round2(penaltyValue),
        grossTotal:           round2(afterArt523),
        abatimentoResults,
        abatimentoTotal:      round2(abatimentoTotal),
        totalValue:           round2(finalTotal),
        installmentResults,
        ...(warnings.size > 0 ? { warnings: [...warnings] } : {}),
    };
}

// ── vários cálculos no mesmo processo ─────────────────────────────────────────

/**
 * Junta os resultados de vários cálculos do mesmo processo (ex.: dois contratos com índices
 * ou juros diferentes). Cada cálculo é feito por inteiro, com os próprios honorários e
 * multas, e os valores são somados, como se fossem cálculos separados. As parcelas e os
 * abatimentos levam o nome do cálculo na descrição. Com um cálculo só, nada muda.
 */
export function combineResults(parts: { label: string; result: CalculationResult }[]): CalculationResult {
    if (parts.length === 1) return parts[0].result;

    const sum = (pick: (r: CalculationResult) => number) =>
        round2(parts.reduce((total, p) => total + pick(p.result), 0));

    const installmentResults: InstallmentResult[] = [];
    const abatimentoResults: AbatimentoResult[] = [];
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
