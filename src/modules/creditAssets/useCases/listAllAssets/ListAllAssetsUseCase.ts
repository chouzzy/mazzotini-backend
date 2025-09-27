// /src/modules/creditAssets/useCases/listAllAssets/ListAllAssetsUseCase.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Tipagem para o retorno, incluindo um resumo do investidor principal
export type AssetSummary = {
    id: string;
    processNumber: string;
    originalCreditor: string;
    currentValue: number;
    status: string;
    acquisitionDate: Date;
    mainInvestorName: string | null;
};

/**
 * @class ListAllAssetsUseCase
 * @description Lógica de negócio para buscar um resumo de todos os ativos de crédito.
 */
class ListAllAssetsUseCase {
    async execute(): Promise<AssetSummary[]> {
        console.log(`[ADMIN] Buscando a lista completa de ativos...`);

        const assets = await prisma.creditAsset.findMany({
            orderBy: {
                acquisitionDate: 'desc',
            },
            include: {
                investors: {
                    // Pega apenas o primeiro investidor da lista para exibição
                    take: 1, 
                    include: {
                        user: {
                            select: { name: true }
                        }
                    }
                }
            }
        });

        // Mapeia o resultado para o formato de resumo que o frontend precisa
        const summarizedAssets = assets.map(asset => ({
            id: asset.id,
            processNumber: asset.processNumber,
            originalCreditor: asset.originalCreditor,
            currentValue: asset.currentValue,
            status: asset.status,
            acquisitionDate: asset.acquisitionDate,
            mainInvestorName: asset.investors[0]?.user.name || 'N/A'
        }));
        
        console.log(`[ADMIN] ${summarizedAssets.length} ativos encontrados.`);
        return summarizedAssets;
    }
}

export { ListAllAssetsUseCase };

