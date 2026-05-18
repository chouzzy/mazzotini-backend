import { prisma } from '../../../../prisma';
import { Installment } from '../../../../services/judicialCalculatorService';

interface IRequest {
    legalOneId: number;
    correctionIndex: string;
    moratoryMode?: string;
    moratoryRate: number;
    moratoryType: string;
    moratoryStartDate?: string | null;
    compensatoryRate: number;
    compensatoryType: string;
    compensatoryStartDate?: string | null;
    multaPercentage?: number;
    feesPercentage: number;
    penaltyPercentage: number;
    feesOnPenalty: boolean;
    installments: Installment[];
}

class SetCalculationParamsUseCase {
    async execute(data: IRequest) {
        const asset = await prisma.creditAsset.findUnique({ where: { legalOneId: data.legalOneId } });
        if (!asset) throw new Error('Processo não encontrado.');

        const shared = {
            correctionIndex:      data.correctionIndex,
            moratoryMode:         data.moratoryMode ?? 'TAXA_LEGAL',
            moratoryRate:         data.moratoryRate,
            moratoryType:         data.moratoryType,
            moratoryStartDate:    data.moratoryStartDate    ? new Date(data.moratoryStartDate)    : null,
            compensatoryRate:      data.compensatoryRate,
            compensatoryType:      data.compensatoryType,
            compensatoryStartDate: data.compensatoryStartDate ? new Date(data.compensatoryStartDate) : null,
            multaPercentage:       data.multaPercentage ?? 0,
            feesPercentage:        data.feesPercentage,
            penaltyPercentage:     data.penaltyPercentage,
            feesOnPenalty:         data.feesOnPenalty,
            installments:         data.installments as any,
        };

        const params = await prisma.processCalculationParams.upsert({
            where:  { assetId: asset.id },
            create: { assetId: asset.id, ...shared },
            update: shared,
        });

        return params;
    }
}

export { SetCalculationParamsUseCase };
