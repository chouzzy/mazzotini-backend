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
    feesPercentage: number;
    penaltyPercentage: number;
    penaltyStartDate?: string | null;
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
            compensatoryRate:     data.compensatoryRate,
            compensatoryType:     data.compensatoryType,
            compensatoryStartDate: data.compensatoryStartDate ? new Date(data.compensatoryStartDate) : null,
            feesPercentage:       data.feesPercentage,
            penaltyPercentage:    data.penaltyPercentage,
            penaltyStartDate:     data.penaltyStartDate     ? new Date(data.penaltyStartDate)     : null,
            feesOnPenalty:        data.feesOnPenalty,
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
