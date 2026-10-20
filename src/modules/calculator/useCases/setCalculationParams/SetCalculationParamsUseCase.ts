import { Prisma } from '@prisma/client';
import { prisma } from '../../../../prisma';
import { MAX_EXTRA_CALCULATIONS, validateCalculation, validateLabel } from '../../calculationInput';

/**
 * Corpo do PUT /api/calculator/:legalOneId/params: os campos do cálculo principal e, com
 * vários cálculos no mesmo processo, `calculationLabel` (nome do primeiro) e
 * `extraCalculations` (os demais). Ausentes, esses dois ficam como estão; null os apaga.
 */
type IRequest = { legalOneId: number } & Record<string, unknown>;

class SetCalculationParamsUseCase {
    async execute(data: IRequest) {
        const asset = await prisma.creditAsset.findUnique({ where: { legalOneId: data.legalOneId } });
        if (!asset) throw new Error('Processo não encontrado.');

        const extrasInput = data.extraCalculations;
        if (extrasInput !== undefined && extrasInput !== null && !Array.isArray(extrasInput)) {
            throw new Error('Os cálculos extras devem ser uma lista.');
        }
        if (Array.isArray(extrasInput) && extrasInput.length > MAX_EXTRA_CALCULATIONS) {
            throw new Error(`O processo pode ter até ${MAX_EXTRA_CALCULATIONS + 1} cálculos.`);
        }

        // Com mais de um cálculo, as mensagens de erro dizem qual deles está errado
        const hasExtras = Array.isArray(extrasInput) && extrasInput.length > 0;
        const mainLabel = validateLabel(data.calculationLabel, 'Cálculo 1');
        const main = validateCalculation(data, hasExtras ? mainLabel : null);

        const extras = Array.isArray(extrasInput)
            ? extrasInput.map((raw, i) => {
                if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
                    throw new Error(`Cálculo ${i + 2}: formato inválido.`);
                }
                const label = validateLabel((raw as Record<string, unknown>).label, `Cálculo ${i + 2}`);
                const calc = validateCalculation(raw, label);
                // Dentro do JSON, as datas ficam em texto ISO
                return {
                    label,
                    ...calc,
                    moratoryStartDate:     calc.moratoryStartDate?.toISOString() ?? null,
                    compensatoryStartDate: calc.compensatoryStartDate?.toISOString() ?? null,
                };
            })
            : extrasInput === null ? [] : undefined;

        // Lista vazia (e não null) apaga os extras sem precisar do JsonNull do Prisma
        const fields = {
            ...main,
            installments: main.installments as unknown as Prisma.InputJsonValue,
            ...(data.calculationLabel !== undefined
                ? { calculationLabel: typeof data.calculationLabel === 'string' && data.calculationLabel.trim() ? mainLabel : null }
                : {}),
            ...(extras !== undefined ? { extraCalculations: extras as unknown as Prisma.InputJsonValue } : {}),
        };

        return prisma.processCalculationParams.upsert({
            where:  { assetId: asset.id },
            create: { assetId: asset.id, ...fields },
            update: fields,
        });
    }
}

export { SetCalculationParamsUseCase };
