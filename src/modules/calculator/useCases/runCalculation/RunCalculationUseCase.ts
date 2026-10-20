import type { ProcessCalculationParams } from '@prisma/client';
import { prisma } from '../../../../prisma';
import {
    calculateJudicialDebt, CalculationParams, CalculationResult, combineResults, Installment,
} from '../../../../services/judicialCalculatorService';
import { CALCULATION_DEFAULTS } from '../../calculationInput';

interface IRequest {
    legalOneId: number;
    auth0UserId: string;
    referenceYear?:  number;
    referenceMonth?: number;
}

/**
 * Monta os parâmetros do motor a partir do registro salvo.
 * O botão "Calcular" e o recálculo automático do dia 5 usam esta mesma montagem,
 * para os dois chegarem ao mesmo valor.
 */
export function toCalculationParams(params: ProcessCalculationParams): CalculationParams {
    const d = CALCULATION_DEFAULTS;
    return {
        correctionIndex:       params.correctionIndex,
        moratoryMode:          params.moratoryMode         ?? d.moratoryMode,
        moratoryRate:          params.moratoryRate,
        moratoryRateUnit:      params.moratoryRateUnit     ?? d.moratoryRateUnit,
        moratoryType:          params.moratoryType,
        moratoryStartDate:     params.moratoryStartDate?.toISOString() ?? null,
        compensatoryRate:      params.compensatoryRate,
        compensatoryRateUnit:  params.compensatoryRateUnit ?? d.compensatoryRateUnit,
        compensatoryType:      params.compensatoryType,
        compensatoryStartDate: params.compensatoryStartDate ? new Date(params.compensatoryStartDate).toISOString() : null,
        multaPercentage:       params.multaPercentage      ?? d.multaPercentage,
        feesMode:              params.feesMode             ?? d.feesMode,
        feesPercentage:        params.feesPercentage,
        feesFixedValue:        params.feesFixedValue       ?? d.feesFixedValue,
        penaltyPercentage:     params.penaltyPercentage,
        feesOnPenalty:         params.feesOnPenalty,
        installments:          params.installments as unknown as Installment[],
    };
}

/** Cálculo extra como fica gravado em `extraCalculations` (datas em texto ISO). */
type StoredExtraCalculation = Partial<CalculationParams> & { label?: string };

/** Os outros cálculos do processo (`extraCalculations`), com os mesmos padrões do primeiro. */
export function toExtraCalculations(params: ProcessCalculationParams): { label: string; params: CalculationParams }[] {
    const extras = Array.isArray(params.extraCalculations)
        ? (params.extraCalculations as unknown as StoredExtraCalculation[])
        : [];
    const d = CALCULATION_DEFAULTS;
    return extras.map((e, i) => ({
        label: (typeof e.label === 'string' && e.label.trim()) || `Cálculo ${i + 2}`,
        params: {
            correctionIndex:       e.correctionIndex       ?? '',
            moratoryMode:          e.moratoryMode          ?? d.moratoryMode,
            moratoryRate:          e.moratoryRate          ?? d.moratoryRate,
            moratoryRateUnit:      e.moratoryRateUnit      ?? d.moratoryRateUnit,
            moratoryType:          e.moratoryType          ?? d.moratoryType,
            moratoryStartDate:     e.moratoryStartDate     ?? null,
            compensatoryRate:      e.compensatoryRate      ?? d.compensatoryRate,
            compensatoryRateUnit:  e.compensatoryRateUnit  ?? d.compensatoryRateUnit,
            compensatoryType:      e.compensatoryType      ?? d.compensatoryType,
            compensatoryStartDate: e.compensatoryStartDate ?? null,
            multaPercentage:       e.multaPercentage       ?? d.multaPercentage,
            feesMode:              e.feesMode              ?? d.feesMode,
            feesPercentage:        e.feesPercentage        ?? d.feesPercentage,
            feesFixedValue:        e.feesFixedValue        ?? d.feesFixedValue,
            penaltyPercentage:     e.penaltyPercentage     ?? d.penaltyPercentage,
            feesOnPenalty:         e.feesOnPenalty         ?? d.feesOnPenalty,
            installments:          e.installments          ?? [],
        },
    }));
}

class RunCalculationUseCase {
    async execute({ legalOneId, auth0UserId, referenceYear, referenceMonth }: IRequest) {
        const asset = await prisma.creditAsset.findUnique({ where: { legalOneId } });
        if (!asset) throw new Error('Processo não encontrado.');

        const params = await prisma.processCalculationParams.findUnique({ where: { assetId: asset.id } });
        if (!params) throw new Error('Parâmetros de cálculo não configurados para este processo.');

        const now   = new Date();
        const refY  = referenceYear  ?? now.getFullYear();
        const refM  = referenceMonth ?? (now.getMonth() + 1);

        return this.calculateAndSave(params, auth0UserId, refY, refM);
    }

    /**
     * Calcula, grava o log e atualiza o valor atual do processo.
     * `calculatedBy` é o usuário que clicou em "Calcular" ou `'cron'` no recálculo do dia 5.
     */
    async calculateAndSave(
        params: ProcessCalculationParams,
        calculatedBy: string,
        refY: number,
        refM: number,
    ): Promise<CalculationResult> {
        const calcParams = toCalculationParams(params);
        const extras     = toExtraCalculations(params);

        let result: CalculationResult;
        let paramsSnapshot: object = calcParams;
        if (extras.length === 0) {
            result = await calculateJudicialDebt(calcParams, refY, refM);
        } else {
            // Vários cálculos no mesmo processo: cada um é feito por inteiro e o valor é a soma
            const parts = [{ label: params.calculationLabel?.trim() || 'Cálculo 1', params: calcParams }, ...extras];
            const results: { label: string; result: CalculationResult }[] = [];
            for (const part of parts) {
                try {
                    results.push({ label: part.label, result: await calculateJudicialDebt(part.params, refY, refM) });
                } catch (e: any) {
                    throw new Error(`${part.label}: ${e.message}`);
                }
            }
            result = combineResults(results);
            paramsSnapshot = {
                ...calcParams,
                calculationLabel:  parts[0].label,
                extraCalculations: extras.map(e => ({ label: e.label, ...e.params })),
            };
        }

        // Salva log de cálculo, com o snapshot de todos os parâmetros usados (para reabertura futura)
        await prisma.calculationLog.create({
            data: {
                assetId:              params.assetId,
                calculatedBy,
                referenceMonth:       refM,
                referenceYear:        refY,
                baseTotal:            result.baseTotal,
                correctedValue:       result.correctedValue,
                moratoryInterest:     result.moratoryInterest,
                compensatoryInterest: result.compensatoryInterest,
                feesValue:            result.feesValue,
                penaltyValue:         result.penaltyValue,
                totalValue:           result.totalValue,
                breakdown:            result.installmentResults as any,
                paramsSnapshot:       paramsSnapshot as any,
            },
        });

        // Atualiza o valor atual do processo e timestamp do último cálculo
        await prisma.processCalculationParams.update({
            where: { assetId: params.assetId },
            data: {
                lastCalculatedValue: result.totalValue,
                lastCalculatedAt:    new Date(),
            },
        });

        await prisma.creditAsset.update({
            where: { id: params.assetId },
            data:  { currentValue: result.totalValue },
        });

        return result;
    }
}

export { RunCalculationUseCase };
