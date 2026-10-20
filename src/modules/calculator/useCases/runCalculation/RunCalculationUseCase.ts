import type { ProcessCalculationParams } from '@prisma/client';
import { prisma } from '../../../../prisma';
import {
    calculateJudicialDebt, CalculationParams, CalculationResult, combineResults, Installment,
} from '../../../../services/judicialCalculatorService';

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
    return {
        correctionIndex:       params.correctionIndex,
        moratoryMode:          params.moratoryMode         ?? 'TAXA_LEGAL',
        moratoryRate:          params.moratoryRate,
        moratoryRateUnit:      params.moratoryRateUnit     ?? 'AM',
        moratoryType:          params.moratoryType,
        moratoryStartDate:     params.moratoryStartDate?.toISOString() ?? null,
        compensatoryRate:      params.compensatoryRate,
        compensatoryRateUnit:  params.compensatoryRateUnit ?? 'AM',
        compensatoryType:      params.compensatoryType,
        compensatoryStartDate: params.compensatoryStartDate ? new Date(params.compensatoryStartDate).toISOString() : null,
        multaPercentage:       params.multaPercentage      ?? 0,
        feesMode:              params.feesMode             ?? 'PERCENTUAL',
        feesPercentage:        params.feesPercentage,
        feesFixedValue:        params.feesFixedValue       ?? 0,
        penaltyPercentage:     params.penaltyPercentage,
        feesOnPenalty:         params.feesOnPenalty,
        installments:          params.installments as unknown as Installment[],
    };
}

/** Os outros cálculos do processo (`extraCalculations`), com os mesmos padrões do primeiro. */
export function toExtraCalculations(params: ProcessCalculationParams): { label: string; params: CalculationParams }[] {
    const extras = Array.isArray(params.extraCalculations) ? (params.extraCalculations as any[]) : [];
    return extras.map((e, i) => ({
        label: (typeof e.label === 'string' && e.label.trim()) || `Cálculo ${i + 2}`,
        params: {
            correctionIndex:       e.correctionIndex,
            moratoryMode:          e.moratoryMode          ?? 'TAXA_LEGAL',
            moratoryRate:          e.moratoryRate          ?? 0,
            moratoryRateUnit:      e.moratoryRateUnit      ?? 'AM',
            moratoryType:          e.moratoryType          ?? 'SIMPLES',
            moratoryStartDate:     e.moratoryStartDate     ?? null,
            compensatoryRate:      e.compensatoryRate      ?? 0,
            compensatoryRateUnit:  e.compensatoryRateUnit  ?? 'AM',
            compensatoryType:      e.compensatoryType      ?? 'SIMPLES',
            compensatoryStartDate: e.compensatoryStartDate ?? null,
            multaPercentage:       e.multaPercentage       ?? 0,
            feesMode:              e.feesMode              ?? 'PERCENTUAL',
            feesPercentage:        e.feesPercentage        ?? 0,
            feesFixedValue:        e.feesFixedValue        ?? 0,
            penaltyPercentage:     e.penaltyPercentage     ?? 0,
            feesOnPenalty:         e.feesOnPenalty         ?? false,
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
