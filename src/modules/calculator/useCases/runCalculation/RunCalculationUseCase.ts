import { prisma } from '../../../../prisma';
import { calculateJudicialDebt, CalculationParams, Installment } from '../../../../services/judicialCalculatorService';

interface IRequest {
    legalOneId: number;
    auth0UserId: string;
    referenceYear?:  number;
    referenceMonth?: number;
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

        const p = params as any;
        const calcParams: CalculationParams = {
            correctionIndex:       params.correctionIndex,
            moratoryMode:          p.moratoryMode         ?? 'TAXA_LEGAL',
            moratoryRate:          params.moratoryRate,
            moratoryRateUnit:      p.moratoryRateUnit     ?? 'AM',
            moratoryType:          params.moratoryType,
            moratoryStartDate:     params.moratoryStartDate?.toISOString() ?? null,
            compensatoryRate:      params.compensatoryRate,
            compensatoryRateUnit:  p.compensatoryRateUnit ?? 'AM',
            compensatoryType:      params.compensatoryType,
            compensatoryStartDate: p.compensatoryStartDate ? new Date(p.compensatoryStartDate).toISOString() : null,
            multaPercentage:       p.multaPercentage      ?? 0,
            feesMode:              p.feesMode             ?? 'PERCENTUAL',
            feesPercentage:        params.feesPercentage,
            feesFixedValue:        p.feesFixedValue       ?? 0,
            penaltyPercentage:     params.penaltyPercentage,
            feesOnPenalty:         params.feesOnPenalty,
            installments:          params.installments as unknown as Installment[],
        };

        const result = await calculateJudicialDebt(calcParams, refY, refM);

        // Snapshot de todos os parâmetros usados (para reabertura futura)
        const paramsSnapshot = {
            correctionIndex:       calcParams.correctionIndex,
            moratoryMode:          calcParams.moratoryMode,
            moratoryRate:          calcParams.moratoryRate,
            moratoryRateUnit:      calcParams.moratoryRateUnit,
            moratoryType:          calcParams.moratoryType,
            moratoryStartDate:     calcParams.moratoryStartDate,
            compensatoryRate:      calcParams.compensatoryRate,
            compensatoryRateUnit:  calcParams.compensatoryRateUnit,
            compensatoryType:      calcParams.compensatoryType,
            compensatoryStartDate: calcParams.compensatoryStartDate,
            multaPercentage:       calcParams.multaPercentage,
            feesMode:              calcParams.feesMode,
            feesPercentage:        calcParams.feesPercentage,
            feesFixedValue:        calcParams.feesFixedValue,
            penaltyPercentage:     calcParams.penaltyPercentage,
            feesOnPenalty:         calcParams.feesOnPenalty,
            installments:          calcParams.installments,
        };

        // Salva log de cálculo
        await prisma.calculationLog.create({
            data: {
                assetId:              asset.id,
                calculatedBy:         auth0UserId,
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
            where: { assetId: asset.id },
            data: {
                lastCalculatedValue: result.totalValue,
                lastCalculatedAt:    new Date(),
            },
        });

        await prisma.creditAsset.update({
            where: { id: asset.id },
            data:  { currentValue: result.totalValue },
        });

        return result;
    }
}

export { RunCalculationUseCase };
