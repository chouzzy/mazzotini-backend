import { prisma } from '../../../../prisma';

class GetCalculationParamsUseCase {
    async execute(legalOneId: number) {
        const asset = await prisma.creditAsset.findUnique({ where: { legalOneId } });
        if (!asset) throw new Error('Processo não encontrado.');

        const params = await prisma.processCalculationParams.findUnique({ where: { assetId: asset.id } });
        return params; // null se ainda não configurado
    }
}

export { GetCalculationParamsUseCase };
