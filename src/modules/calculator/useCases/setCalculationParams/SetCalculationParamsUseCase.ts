import { prisma } from '../../../../prisma';
import { Installment } from '../../../../services/judicialCalculatorService';

interface IRequest {
    legalOneId: number;
    correctionIndex: string;
    moratoryMode?: string;
    moratoryRate: number;
    moratoryRateUnit?: string;
    moratoryType: string;
    moratoryStartDate?: string | null;
    compensatoryRate: number;
    compensatoryRateUnit?: string;
    compensatoryType: string;
    compensatoryStartDate?: string | null;
    multaPercentage?: number;
    feesMode?: string;
    feesPercentage: number;
    feesFixedValue?: number;
    penaltyPercentage: number;
    feesOnPenalty: boolean;
    installments: Installment[];
}

class SetCalculationParamsUseCase {
    async execute(data: IRequest) {
        const asset = await prisma.creditAsset.findUnique({ where: { legalOneId: data.legalOneId } });
        if (!asset) throw new Error('Processo não encontrado.');

        const shared = {
            correctionIndex:       data.correctionIndex,
            moratoryMode:          data.moratoryMode      ?? 'TAXA_LEGAL',
            moratoryRate:          data.moratoryRate,
            moratoryRateUnit:      data.moratoryRateUnit  ?? 'AM',
            moratoryType:          data.moratoryType,
            moratoryStartDate:     data.moratoryStartDate     ? new Date(data.moratoryStartDate)     : null,
            compensatoryRate:      data.compensatoryRate,
            compensatoryRateUnit:  data.compensatoryRateUnit  ?? 'AM',
            compensatoryType:      data.compensatoryType,
            compensatoryStartDate: data.compensatoryStartDate ? new Date(data.compensatoryStartDate) : null,
            multaPercentage:       data.multaPercentage   ?? 0,
            feesMode:              data.feesMode          ?? 'PERCENTUAL',
            feesPercentage:        data.feesPercentage,
            feesFixedValue:        data.feesFixedValue    ?? 0,
            penaltyPercentage:     data.penaltyPercentage,
            feesOnPenalty:         data.feesOnPenalty,
            installments:          data.installments as any,
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
