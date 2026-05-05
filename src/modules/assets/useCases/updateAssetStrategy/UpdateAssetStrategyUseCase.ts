// src/modules/assets/useCases/updateAssetStrategy/UpdateAssetStrategyUseCase.ts



import { prisma } from '../../../../prisma';
import { AppError } from '../../../../errors/AppError';

interface IRequest {
    assetId: string;
    strategyText: string;
}

export class UpdateAssetStrategyUseCase {
    async execute({ assetId, strategyText }: IRequest) {
        // Verifica se o processo existe
        const asset = await prisma.creditAsset.findUnique({
            where: { id: assetId }
        });

        if (!asset) {
            throw new AppError('Processo não encontrado', 404);
        }

        // Atualiza apenas o campo da estratégia
        const updatedAsset = await prisma.creditAsset.update({
            where: { id: assetId },
            data: { strategyText }
        });

        return updatedAsset;
    }
}

