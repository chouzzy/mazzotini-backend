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

        const calcParams: CalculationParams = {
            correctionIndex:    params.correctionIndex,
            moratoryMode:       (params as any).moratoryMode ?? 'TAXA_LEGAL',
            moratoryRate:       params.moratoryRate,
            moratoryType:       params.moratoryType,
            moratoryStartDate:  params.moratoryStartDate?.toISOString() ?? null,
            compensatoryRate:   params.compensatoryRate,
            compensatoryType:   params.compensatoryType,
            feesPercentage:     params.feesPercentage,
            penaltyPercentage:  params.penaltyPercentage,
            feesOnPenalty:      params.feesOnPenalty,
            installments:       params.installments as unknown as Installment[],
        };

        const result = await calculateJudicialDebt(calcParams, refY, refM);

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
