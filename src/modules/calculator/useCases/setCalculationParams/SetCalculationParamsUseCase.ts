import { prisma } from '../../../../prisma';
import { Installment } from '../../../../services/judicialCalculatorService';

interface CalculationInput {
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

interface ExtraCalculationInput extends CalculationInput {
    label?: string;
}

interface IRequest extends CalculationInput {
    legalOneId: number;
    // Vários cálculos no mesmo processo: nome do primeiro e os demais.
    // Ausentes, ficam como estão; vazios, são apagados.
    calculationLabel?: string | null;
    extraCalculations?: ExtraCalculationInput[] | null;
}

/** Data recebida (ISO) → texto ISO, para guardar dentro do JSON dos cálculos extras. */
function toIsoOrNull(value: string | null | undefined, label: string): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (isNaN(date.getTime())) throw new Error(`${label}: data inválida (${value}).`);
    return date.toISOString();
}

/** Cálculo extra com os mesmos padrões do primeiro. Exige o índice e ao menos uma parcela de débito. */
function normalizeExtra(extra: ExtraCalculationInput, index: number) {
    const label = extra.label?.trim() || `Cálculo ${index + 2}`;
    if (!extra.correctionIndex) throw new Error(`${label}: escolha o índice de correção.`);
    const debits = (extra.installments ?? []).filter(i => (i.type ?? 'DEBITO') === 'DEBITO');
    if (debits.length === 0) throw new Error(`${label}: informe ao menos uma parcela de débito.`);

    return {
        label,
        correctionIndex:       extra.correctionIndex,
        moratoryMode:          extra.moratoryMode         ?? 'TAXA_LEGAL',
        moratoryRate:          extra.moratoryRate         ?? 0,
        moratoryRateUnit:      extra.moratoryRateUnit     ?? 'AM',
        moratoryType:          extra.moratoryType         ?? 'SIMPLES',
        moratoryStartDate:     toIsoOrNull(extra.moratoryStartDate, label),
        compensatoryRate:      extra.compensatoryRate     ?? 0,
        compensatoryRateUnit:  extra.compensatoryRateUnit ?? 'AM',
        compensatoryType:      extra.compensatoryType     ?? 'SIMPLES',
        compensatoryStartDate: toIsoOrNull(extra.compensatoryStartDate, label),
        multaPercentage:       extra.multaPercentage      ?? 0,
        feesMode:              extra.feesMode             ?? 'PERCENTUAL',
        feesPercentage:        extra.feesPercentage       ?? 0,
        feesFixedValue:        extra.feesFixedValue       ?? 0,
        penaltyPercentage:     extra.penaltyPercentage    ?? 0,
        feesOnPenalty:         extra.feesOnPenalty        ?? false,
        installments:          extra.installments,
    };
}

class SetCalculationParamsUseCase {
    async execute(data: IRequest) {
        const asset = await prisma.creditAsset.findUnique({ where: { legalOneId: data.legalOneId } });
        if (!asset) throw new Error('Processo não encontrado.');

        const shared: Record<string, unknown> = {
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

        if (data.calculationLabel !== undefined) {
            shared.calculationLabel = data.calculationLabel?.trim() || null;
        }
        if (data.extraCalculations !== undefined) {
            // Lista vazia (e não null) apaga os extras sem precisar do JsonNull do Prisma
            shared.extraCalculations = (data.extraCalculations ?? []).map(normalizeExtra);
        }

        const params = await prisma.processCalculationParams.upsert({
            where:  { assetId: asset.id },
            create: { assetId: asset.id, ...shared } as any,
            update: shared,
        });

        return params;
    }
}

export { SetCalculationParamsUseCase };
