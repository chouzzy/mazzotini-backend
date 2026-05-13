import { prisma } from '../../../../prisma';
import { Installment } from '../../../../services/judicialCalculatorService';

interface IRequest {
    legalOneId: number;
    correctionIndex: string;
    moratoryRate: number;
    moratoryType: string;
    moratoryStartDate?: string | null;
    compensatoryRate: number;
    compensatoryType: string;
    feesPercentage: number;
    penaltyPercentage: number;
    feesOnPenalty: boolean;
    installments: Installment[];
}

class SetCalculationParamsUseCase {
    async execute(data: IRequest) {
        const asset = await prisma.creditAsset.findUnique({ where: { legalOneId: data.legalOneId } });
        if (!asset) throw new Error('Processo não encontrado.');

        const params = await prisma.processCalculationParams.upsert({
            where:  { assetId: asset.id },
            create: {
                assetId:         asset.id,
                correctionIndex: data.correctionIndex,
                moratoryRate:    data.moratoryRate,
                moratoryType:    data.moratoryType,
                moratoryStartDate: data.moratoryStartDate ? new Date(data.moratoryStartDate) : null,
                compensatoryRate:  data.compensatoryRate,
                compensatoryType:  data.compensatoryType,
                feesPercentage:    data.feesPercentage,
                penaltyPercentage: data.penaltyPercentage,
                feesOnPenalty:     data.feesOnPenalty,
                installments:      data.installments as any,
            },
            update: {
                correctionIndex: data.correctionIndex,
                moratoryRate:    data.moratoryRate,
                moratoryType:    data.moratoryType,
                moratoryStartDate: data.moratoryStartDate ? new Date(data.moratoryStartDate) : null,
                compensatoryRate:  data.compensatoryRate,
                compensatoryType:  data.compensatoryType,
                feesPercentage:    data.feesPercentage,
                penaltyPercentage: data.penaltyPercentage,
                feesOnPenalty:     data.feesOnPenalty,
                installments:      data.installments as any,
            },
        });

        return params;
    }
}

export { SetCalculationParamsUseCase };
