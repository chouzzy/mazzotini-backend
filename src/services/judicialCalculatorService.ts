/**
 * JudicialCalculatorService
 *
 * Engine de cálculo de débitos judiciais.
 *
 * Fator de correção (dois modos):
 *   Modo 1 (acumulado, preferencial):
 *     factor = accumulatedValue(referência) / accumulatedValue(base)
 *     Usa os valores acumulados oficiais (tabela drcalc.net), eliminando
 *     erro de arredondamento acumulado do produto mensal.
 *   Modo 2 (fallback, produto mensal):
 *     factor = ∏(1 + taxa_i / 100)
 *
 * Demais componentes:
 *   Juros moratórios simples  = valorCorrigido × (taxa% × nMeses)
 *   Honorários = (corrigido + juros) × hon%
 *   Subtotal B = corrigido + juros + honorários
 *   Multa Art.523 = subtotalB × multa%
 *   Honorários Art.523 = subtotalB × hon%  (se habilitado)
 */

import { prisma } from '../prisma';

export interface Installment {
    baseValue: number;
    baseDate:  string; // ISO date string
    description?: string;
}

export interface CalculationParams {
    correctionIndex:     string;
    moratoryRate:        number;  // % mensal
    moratoryType:        string;  // "SIMPLES" | "COMPOSTO"
    moratoryStartDate?:  string | null;
    compensatoryRate:    number;
    compensatoryType:    string;
    feesPercentage:      number;
    penaltyPercentage:   number;
    feesOnPenalty:       boolean;
    installments:        Installment[];
}

export interface MonthBreakdown {
    year:         number;
    month:        number;
    monthlyRate:  number;
    accumulated:  number; // fator acumulado até este mês
}

export interface InstallmentResult {
    installmentIndex: number;
    description:      string;
    baseValue:        number;
    baseDate:         string;
    correctionFactor: number;
    correctedValue:   number;
    moratoryMonths:   number;
    moratoryInterest: number;
    compensatoryInterest: number;
    feesValue:        number;
    penaltyValue:     number;
    subtotal:         number;
    monthBreakdown:   MonthBreakdown[];
}

export interface CalculationResult {
    referenceMonth:      number;
    referenceYear:       number;
    baseTotal:           number;
    correctedValue:      number;
    moratoryInterest:    number;
    compensatoryInterest: number;
    feesValue:           number;
    penaltyValue:        number;
    totalValue:          number;
    installmentResults:  InstallmentResult[];
}

// ── utilidades de data ────────────────────────────────────────────────────────

function parseYM(isoDate: string): { year: number; month: number } {
    const d = new Date(isoDate);
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

function monthsBetween(startYear: number, startMonth: number, endYear: number, endMonth: number): number {
    return (endYear - startYear) * 12 + (endMonth - startMonth);
}

// Retorna lista de {year, month} de startMonth até endMonth (inclusive)
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

// ── engine principal ──────────────────────────────────────────────────────────

export async function calculateJudicialDebt(
    params: CalculationParams,
    referenceYear: number,
    referenceMonth: number,
): Promise<CalculationResult> {

    // 1. Busca índices do banco — inclui o mês base para poder usar o ratio acumulado
    const sortedInstallments = [...params.installments].sort(
        (a, b) => new Date(a.baseDate).getTime() - new Date(b.baseDate).getTime()
    );
    if (sortedInstallments.length === 0) throw new Error('Nenhuma parcela informada.');

    const globalStart = parseYM(sortedInstallments[0].baseDate);

    // Range inclui o próprio mês base (para accumulatedValue do mês base)
    const fetchRange = monthRange(globalStart.year, globalStart.month, referenceYear, referenceMonth);

    const indexRecords = await prisma.indexSeries.findMany({
        where: {
            indexName: params.correctionIndex,
            OR: fetchRange.map(({ year, month }) => ({ year, month })),
        },
    });

    // Mapa: "YYYY-MM" → { monthlyRate, accumulatedValue }
    const rateMap = new Map<string, { monthlyRate: number; accumulatedValue: number | null }>();
    for (const rec of indexRecords) {
        rateMap.set(`${rec.year}-${String(rec.month).padStart(2, '0')}`, {
            monthlyRate:     rec.monthlyRate,
            accumulatedValue: rec.accumulatedValue ?? null,
        });
    }

    // 2. Calcula cada parcela
    const installmentResults: InstallmentResult[] = [];
    let totalBase        = 0;
    let totalCorrected   = 0;
    let totalMoratory    = 0;
    let totalCompensatory = 0;
    let totalFees        = 0;
    let totalPenalty     = 0;

    for (let i = 0; i < params.installments.length; i++) {
        const inst = params.installments[i];
        const { year: sy, month: sm } = parseYM(inst.baseDate);

        // Meses a corrigir: mês seguinte ao base → referência
        const corrMonths = monthRange(sy, sm + 1, referenceYear, referenceMonth);

        // Chaves para o ratio acumulado
        const baseKey = `${sy}-${String(sm).padStart(2, '0')}`;
        const refKey  = `${referenceYear}-${String(referenceMonth).padStart(2, '0')}`;
        const baseRec = rateMap.get(baseKey);
        const refRec  = rateMap.get(refKey);

        let factor = 1;
        const breakdown: MonthBreakdown[] = [];

        if (baseRec?.accumulatedValue && refRec?.accumulatedValue) {
            // Modo 1 (preferencial): ratio direto — elimina erro de arredondamento acumulado
            factor = refRec.accumulatedValue / baseRec.accumulatedValue;

            // Reconstrói breakdown apenas para exibição
            let runAcc = baseRec.accumulatedValue;
            for (const { year, month } of corrMonths) {
                const key = `${year}-${String(month).padStart(2, '0')}`;
                const rec = rateMap.get(key);
                const monthlyRate = rec?.monthlyRate ?? 0;
                const thisAcc     = rec?.accumulatedValue ?? runAcc * (1 + monthlyRate / 100);
                runAcc = thisAcc;
                breakdown.push({ year, month, monthlyRate, accumulated: thisAcc / baseRec.accumulatedValue });
            }
        } else {
            // Modo 2 (fallback): produto dos fatores mensais
            for (const { year, month } of corrMonths) {
                const key  = `${year}-${String(month).padStart(2, '0')}`;
                const rate = rateMap.get(key)?.monthlyRate ?? 0;
                factor *= (1 + rate / 100);
                breakdown.push({ year, month, monthlyRate: rate, accumulated: factor });
            }
        }

        const correctedValue = inst.baseValue * factor;

        // Juros moratórios
        const moratoryStart = params.moratoryStartDate
            ? parseYM(params.moratoryStartDate)
            : { year: sy, month: sm };

        const nMoratory = Math.max(0, monthsBetween(
            moratoryStart.year, moratoryStart.month,
            referenceYear, referenceMonth,
        ));

        let moratoryInterest = 0;
        if (params.moratoryRate > 0 && nMoratory > 0) {
            if (params.moratoryType === 'SIMPLES') {
                moratoryInterest = correctedValue * (params.moratoryRate / 100) * nMoratory;
            } else {
                moratoryInterest = correctedValue * (Math.pow(1 + params.moratoryRate / 100, nMoratory) - 1);
            }
        }

        // Juros compensatórios
        let compensatoryInterest = 0;
        if (params.compensatoryRate > 0) {
            if (params.compensatoryType === 'SIMPLES') {
                compensatoryInterest = correctedValue * (params.compensatoryRate / 100) * corrMonths.length;
            } else {
                compensatoryInterest = correctedValue * (Math.pow(1 + params.compensatoryRate / 100, corrMonths.length) - 1);
            }
        }

        // Subtotal A: base para honorários (corrigido + juros)
        const subtotalA = correctedValue + moratoryInterest + compensatoryInterest;

        // Honorários principais (10% sobre Subtotal A)
        const feesValue = subtotalA * (params.feesPercentage / 100);

        // Subtotal B: base para Art. 523 (Subtotal A + honorários)
        const subtotalB = subtotalA + feesValue;

        // Art. 523 § 1.º — multa (% sobre Subtotal B)
        const penaltyValue = subtotalB * (params.penaltyPercentage / 100);

        // Art. 523 § 1.º — honorários advocatícios (% sobre Subtotal B, se habilitado)
        const feesOnPenaltyValue = params.feesOnPenalty
            ? subtotalB * (params.feesPercentage / 100)
            : 0;

        const subtotal = subtotalB + penaltyValue + feesOnPenaltyValue;

        installmentResults.push({
            installmentIndex: i + 1,
            description: inst.description || `Parcela ${i + 1}`,
            baseValue:    inst.baseValue,
            baseDate:     inst.baseDate,
            correctionFactor: parseFloat(factor.toFixed(8)),
            correctedValue:   round2(correctedValue),
            moratoryMonths:   nMoratory,
            moratoryInterest: round2(moratoryInterest),
            compensatoryInterest: round2(compensatoryInterest),
            feesValue:    round2(feesValue + feesOnPenaltyValue),
            penaltyValue: round2(penaltyValue),
            subtotal:     round2(subtotal),
            monthBreakdown: breakdown,
        });

        totalBase         += inst.baseValue;
        totalCorrected    += correctedValue;
        totalMoratory     += moratoryInterest;
        totalCompensatory += compensatoryInterest;
        totalFees         += feesValue + feesOnPenaltyValue;
        totalPenalty      += penaltyValue;
    }

    return {
        referenceMonth,
        referenceYear,
        baseTotal:           round2(totalBase),
        correctedValue:      round2(totalCorrected),
        moratoryInterest:    round2(totalMoratory),
        compensatoryInterest: round2(totalCompensatory),
        feesValue:           round2(totalFees),
        penaltyValue:        round2(totalPenalty),
        totalValue:          round2(totalCorrected + totalMoratory + totalCompensatory + totalFees + totalPenalty),
        installmentResults,
    };
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}
