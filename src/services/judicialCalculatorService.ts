/**
 * JudicialCalculatorService
 *
 * Suporta:
 *   - Parcelas de débito (tipo DEBITO) e abatimentos/descontos (tipo ABATIMENTO)
 *   - Abatimentos corrigidos pelo mesmo índice até o mês de referência
 *   - 4 pontos de dedução: DO_VALOR_CORRIGIDO | APOS_HONORARIOS | APOS_MULTA | APOS_TUDO
 *   - Juros Moratórios: Taxa Legal piecewise (art.406/CC) ou Personalizado
 *   - Juros Remuneratórios: taxa adicional (compensatoryRate)
 */

import { prisma } from '../prisma';

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
    moratoryType:             string;  // "SIMPLES" | "COMPOSTO"
    moratoryStartDate?:       string | null;
    compensatoryRate:         number;
    compensatoryType:         string;
    compensatoryStartDate?:   string | null;
    feesPercentage:           number;
    penaltyPercentage:        number;
    penaltyStartDate?:        string | null;
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
    subtotalA:            number;   // corrected + moratory + compensatory
    feesValue:            number;   // honorários principais
    subtotalB:            number;   // subtotalA + fees
    penaltyValue:         number;   // multa Art.523
    grossTotal:           number;   // antes dos abatimentos
    abatimentoResults:    AbatimentoResult[];
    abatimentoTotal:      number;   // total deduzido
    totalValue:           number;   // grossTotal − abatimentoTotal
    installmentResults:   InstallmentResult[];
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

function computeFactor(
    sy: number, sm: number,
    refYear: number, refMonth: number,
    rateMap: Map<string, { monthlyRate: number; accumulatedValue: number | null }>,
): { factor: number; breakdown: MonthBreakdown[] } {
    const corrMonths = monthRange(sy, sm + 1, refYear, refMonth);
    const baseKey    = `${sy}-${String(sm).padStart(2,'0')}`;
    const refKey     = `${refYear}-${String(refMonth).padStart(2,'0')}`;
    const baseRec    = rateMap.get(baseKey);
    const refRec     = rateMap.get(refKey);
    let factor = 1;
    const breakdown: MonthBreakdown[] = [];

    if (baseRec?.accumulatedValue && refRec?.accumulatedValue) {
        factor = refRec.accumulatedValue / baseRec.accumulatedValue;
        let runAcc = baseRec.accumulatedValue;
        for (const { year, month } of corrMonths) {
            const key         = `${year}-${String(month).padStart(2,'0')}`;
            const rec         = rateMap.get(key);
            const monthlyRate = rec?.monthlyRate ?? 0;
            const thisAcc     = rec?.accumulatedValue ?? runAcc * (1 + monthlyRate / 100);
            runAcc = thisAcc;
            breakdown.push({ year, month, monthlyRate, accumulated: thisAcc / baseRec.accumulatedValue });
        }
    } else {
        for (const { year, month } of corrMonths) {
            const key  = `${year}-${String(month).padStart(2,'0')}`;
            const rate = rateMap.get(key)?.monthlyRate ?? 0;
            factor *= (1 + rate / 100);
            breakdown.push({ year, month, monthlyRate: rate, accumulated: factor });
        }
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

    const indexRecords = await prisma.indexSeries.findMany({
        where: { indexName: params.correctionIndex, OR: fetchRange.map(({ year, month }) => ({ year, month })) },
    });

    const rateMap = new Map<string, { monthlyRate: number; accumulatedValue: number | null }>();
    for (const rec of indexRecords) {
        rateMap.set(`${rec.year}-${String(rec.month).padStart(2,'0')}`, {
            monthlyRate:     rec.monthlyRate,
            accumulatedValue: rec.accumulatedValue ?? null,
        });
    }

    // 2. Processa parcelas de DÉBITO
    const installmentResults: InstallmentResult[] = [];
    let totalBase         = 0;
    let totalCorrected    = 0;
    let totalMoratory     = 0;
    let totalCompensatory = 0;

    for (let i = 0; i < debitoInstallments.length; i++) {
        const inst = debitoInstallments[i];
        const { year: sy, month: sm } = parseYM(inst.baseDate);
        const corrMonths = monthRange(sy, sm + 1, referenceYear, referenceMonth);
        const { factor, breakdown } = computeFactor(sy, sm, referenceYear, referenceMonth, rateMap);
        const correctedValue = inst.baseValue * factor;

        const moratoryStart = params.moratoryStartDate ? parseYM(params.moratoryStartDate) : { year: sy, month: sm };
        let moratoryInterest = 0, nMoratory = 0;

        if ((params.moratoryMode ?? 'TAXA_LEGAL') === 'TAXA_LEGAL') {
            const ml = await computeTaxaLegalMoratory(correctedValue, moratoryStart.year, moratoryStart.month, referenceYear, referenceMonth);
            moratoryInterest = ml.interest;
            nMoratory = ml.months;
        } else {
            nMoratory = Math.max(0, monthsBetween(moratoryStart.year, moratoryStart.month, referenceYear, referenceMonth));
            if (params.moratoryRate > 0 && nMoratory > 0) {
                moratoryInterest = params.moratoryType === 'SIMPLES'
                    ? correctedValue * (params.moratoryRate / 100) * nMoratory
                    : correctedValue * (Math.pow(1 + params.moratoryRate / 100, nMoratory) - 1);
            }
        }

        let compensatoryInterest = 0;
        if (params.compensatoryRate > 0) {
            const compStart = params.compensatoryStartDate
                ? parseYM(params.compensatoryStartDate)
                : { year: sy, month: sm };
            const nComp = Math.max(0, monthsBetween(compStart.year, compStart.month, referenceYear, referenceMonth));
            if (nComp > 0) {
                compensatoryInterest = params.compensatoryType === 'SIMPLES'
                    ? correctedValue * (params.compensatoryRate / 100) * nComp
                    : correctedValue * (Math.pow(1 + params.compensatoryRate / 100, nComp) - 1);
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
        const { factor } = computeFactor(sy, sm, referenceYear, referenceMonth, rateMap);
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
    const grossSubtotalA = totalCorrected + totalMoratory + totalCompensatory;

    // DO_VALOR_CORRIGIDO — reduz a base antes dos honorários
    const effectiveSubtotalA = grossSubtotalA - deductAt('DO_VALOR_CORRIGIDO');

    const feesValue    = effectiveSubtotalA * (params.feesPercentage / 100);
    const subtotalB    = effectiveSubtotalA + feesValue;

    // APOS_HONORARIOS — antes de Art.523
    const effectiveSubtotalB = subtotalB - deductAt('APOS_HONORARIOS');

    const penaltyApplies = params.penaltyPercentage > 0 && (
        !params.penaltyStartDate ||
        (() => { const ps = parseYM(params.penaltyStartDate!); return referenceYear > ps.year || (referenceYear === ps.year && referenceMonth >= ps.month); })()
    );
    const penaltyValue      = penaltyApplies ? effectiveSubtotalB * (params.penaltyPercentage / 100) : 0;
    const feesOnPenaltyValue = params.feesOnPenalty ? effectiveSubtotalB * (params.feesPercentage / 100) : 0;
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
