/**
 * JudicialCalculatorService
 *
 * Suporta:
 *   - Parcelas de débito (tipo DEBITO) e abatimentos/descontos (tipo ABATIMENTO)
 *   - Abatimentos corrigidos pelo mesmo índice até o mês de referência
 *   - 4 pontos de dedução: DO_VALOR_CORRIGIDO | APOS_HONORARIOS | APOS_MULTA | APOS_TUDO
 *   - Juros Moratórios: Taxa Legal piecewise (art.406/CC) ou Personalizado
 *   - Juros Remuneratórios: taxa adicional (compensatoryRate)
 *   - Índice NAO_ATUALIZAR ("Não atualizar (fixo)"): sem correção monetária
 */

import { prisma } from '../prisma';

/** "Não atualizar (fixo)": o principal não é corrigido; juros, multa e honorários seguem normais. */
export const NAO_ATUALIZAR = 'NAO_ATUALIZAR';

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

// ── Taxa Legal piecewise (art.406/CC / Lei 14905/2024) ────────────────────────
//
//   P1  ≤ Jan/2003               : 6% a.a.  = 0,5%/mês
//   P2  Fev/2003 → Ago/2024      : 12% a.a. = 1%/mês
//   P3  Set/2024+                 : SELIC mensal − IPCA mensal
//
async function computeTaxaLegalMoratory(
    correctedValue: number,
    startYear: number, startMonth: number,
    refYear: number,   refMonth: number,
): Promise<{ interest: number; months: number }> {
    const hasP3 = refYear > 2024 || (refYear === 2024 && refMonth >= 9);
    const selicMap = new Map<string, number>();
    const ipcaMap  = new Map<string, number>();

    if (hasP3) {
        const p3Range = monthRange(2024, 9, refYear, refMonth);
        const where   = p3Range.map(({ year, month }) => ({ year, month }));
        const [sR, iR] = await Promise.all([
            prisma.indexSeries.findMany({ where: { indexName: 'SELIC', OR: where } }),
            prisma.indexSeries.findMany({ where: { indexName: 'IPCA',  OR: where } }),
        ]);
        for (const r of sR) selicMap.set(`${r.year}-${String(r.month).padStart(2,'0')}`, r.monthlyRate);
        for (const r of iR) ipcaMap.set(`${r.year}-${String(r.month).padStart(2,'0')}`, r.monthlyRate);
    }

    const allMonths = monthRange(startYear, startMonth, refYear, refMonth);
    let totalRate = 0;
    for (const { year, month } of allMonths) {
        let rate: number;
        if (year < 2003 || (year === 2003 && month <= 1))      rate = 0.5;
        else if (year < 2024 || (year === 2024 && month <= 8)) rate = 1.0;
        else {
            const key = `${year}-${String(month).padStart(2,'0')}`;
            rate = Math.max((selicMap.get(key) ?? 0) - (ipcaMap.get(key) ?? 0), 0);
        }
        totalRate += rate;
    }
    return { interest: correctedValue * totalRate / 100, months: allMonths.length };
}

// ── helper: fator de correção para uma data base ──────────────────────────────
//
// Percorre os meses de (base + 1) até a referência. Num mês com o acumulado da tabela
// oficial (drcalc, estendido pelo cron), o fator vem da razão até o último acumulado
// anterior; nos outros, da taxa mensal (mês sem dado = 0%). Com a tabela completa, o
// fator é acumulado(ref) / acumulado(base). Sem acumulado na referência (antes do cron
// do mês), vale a tabela até o último mês que a tem e a taxa mensal depois dele. A taxa
// mensal gravada nos meses da tabela não interfere: a do detalhamento vem do acumulado.
function computeFactor(
    sy: number, sm: number,
    refYear: number, refMonth: number,
    rateMap: Map<string, { monthlyRate: number; accumulatedValue: number | null }>,
): { factor: number; breakdown: MonthBreakdown[] } {
    const corrMonths = monthRange(sy, sm + 1, refYear, refMonth);
    let lastAcc         = rateMap.get(`${sy}-${String(sm).padStart(2,'0')}`)?.accumulatedValue ?? null;
    let factorAtLastAcc = 1;
    let factor          = 1;
    const breakdown: MonthBreakdown[] = [];

    for (const { year, month } of corrMonths) {
        const rec = rateMap.get(`${year}-${String(month).padStart(2,'0')}`);
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

    // 1. Busca índices do banco
    const sortedDebito  = [...debitoInstallments].sort((a, b) => new Date(a.baseDate).getTime() - new Date(b.baseDate).getTime());
    const sortedAbat    = [...abatimentoInstallments].sort((a, b) => new Date(a.baseDate).getTime() - new Date(b.baseDate).getTime());
    const allSorted     = [...sortedDebito, ...sortedAbat].sort((a, b) => new Date(a.baseDate).getTime() - new Date(b.baseDate).getTime());
    const globalStart   = parseYM(allSorted[0].baseDate);
    const fetchRange    = monthRange(globalStart.year, globalStart.month, referenceYear, referenceMonth);

    // "Não atualizar (fixo)" não tem série: o fator é 1 e não há detalhamento mês a mês
    const isFixed = params.correctionIndex === NAO_ATUALIZAR;

    const indexRecords = isFixed ? [] : await prisma.indexSeries.findMany({
        where: { indexName: params.correctionIndex, OR: fetchRange.map(({ year, month }) => ({ year, month })) },
    });

    const rateMap = new Map<string, { monthlyRate: number; accumulatedValue: number | null }>();
    for (const rec of indexRecords) {
        rateMap.set(`${rec.year}-${String(rec.month).padStart(2,'0')}`, {
            monthlyRate:     rec.monthlyRate,
            accumulatedValue: rec.accumulatedValue ?? null,
        });
    }

    const factorFor = (sy: number, sm: number): { factor: number; breakdown: MonthBreakdown[] } =>
        isFixed ? { factor: 1, breakdown: [] } : computeFactor(sy, sm, referenceYear, referenceMonth, rateMap);

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

        if ((params.moratoryMode ?? 'TAXA_LEGAL') === 'TAXA_LEGAL') {
            const ml = await computeTaxaLegalMoratory(correctedValue, moratoryStart.year, moratoryStart.month, referenceYear, referenceMonth);
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

    const penaltyValue       = effectiveSubtotalB * (params.penaltyPercentage / 100);
    // feesOnPenalty só se aplica no modo percentual
    const feesOnPenaltyValue = (params.feesOnPenalty && !isFeesFixed)
        ? effectiveSubtotalB * (params.feesPercentage / 100)
        : 0;
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
    };
}
