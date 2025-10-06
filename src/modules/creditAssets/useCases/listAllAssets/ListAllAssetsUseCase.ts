// /src/modules/creditAssets/useCases/listAllAssets/ListAllAssetsUseCase.ts
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ROLES = {
    ADMIN: process.env.ROLE_ADMIN || 'ADMIN',
    OPERATOR: process.env.ROLE_OPERATOR || 'OPERATOR',
    INVESTOR: process.env.ROLE_INVESTOR || 'INVESTOR',
    ASSOCIATE: process.env.ROLE_ASSOCIATE || 'ASSOCIATE',
};

// Tipagem para o retorno, agora completa com os dados para os componentes de UI
export type AssetSummary = {
    id: string;
    processNumber: string;
    originalCreditor: string;
    currentValue: number;
    status: string;
    acquisitionDate: Date;
    mainInvestorName: string | null;
    investorId: string | null;
    associateId: string | null;
    // Campos adicionados para compatibilidade com os componentes de frontend
    investorShare: number;
    investedValue: number;
    updateIndexType: string | null;
};

const assetWithInvestorPayload = {
    include: { 
        investors: { 
            take: 1, 
            include: { 
                user: { 
                    select: { name: true, id: true }
                } 
            } 
        } 
    }
};

type AssetWithInvestor = Prisma.CreditAssetGetPayload<typeof assetWithInvestorPayload>;

class ListAllAssetsUseCase {
    async execute(auth0UserId: string, roles: string[]): Promise<AssetSummary[]> {
        const primaryRole = roles[0];
        console.log(`[GET ASSETS] Utilizador ${auth0UserId} com role [${primaryRole}] a solicitar a lista de ativos.`);

        const user = await prisma.user.findUnique({
            where: { auth0UserId },
            select: { id: true }
        });

        if (!user) {
            console.warn(`[GET ASSETS] Utilizador com auth0UserId ${auth0UserId} não encontrado na base de dados local.`);
            return [];
        }

        let assets: AssetWithInvestor[] = [];

        switch (primaryRole) {
            case ROLES.ADMIN:
            case ROLES.OPERATOR:
                assets = await prisma.creditAsset.findMany({
                    orderBy: { acquisitionDate: 'desc' },
                    ...assetWithInvestorPayload
                });
                break;
            
            case ROLES.INVESTOR:
                assets = await prisma.creditAsset.findMany({
                    where: { investors: { some: { userId: user.id } } },
                    orderBy: { acquisitionDate: 'desc' },
                    ...assetWithInvestorPayload
                });
                break;

            case ROLES.ASSOCIATE:
                assets = await prisma.creditAsset.findMany({
                    where: { associateId: user.id },
                    orderBy: { acquisitionDate: 'desc' },
                    ...assetWithInvestorPayload
                });
                break;

            default:
                console.warn(`[GET ASSETS] Role [${primaryRole}] desconhecida. A retornar uma lista vazia.`);
                break;
        }
        
        const summarizedAssets = assets.map(asset => {
            const investorShare = asset.investors[0]?.investorShare || 0;
            // Calcula o valor real investido com base na participação
            const investedValue = asset.acquisitionValue * (investorShare / 100);

            return {
                id: asset.id,
                processNumber: asset.processNumber,
                originalCreditor: asset.originalCreditor,
                currentValue: asset.currentValue,
                status: asset.status,
                acquisitionDate: asset.acquisitionDate,
                mainInvestorName: asset.investors[0]?.user.name || 'N/A',
                investorId: asset.investors[0]?.userId || null,
                associateId: asset.associateId || null,
                // Mapeia os novos campos
                investorShare: investorShare,
                investedValue: investedValue,
                updateIndexType: asset.updateIndexType || null,
            };
        });
        
        console.log(`[GET ASSETS] ${summarizedAssets.length} ativos encontrados e formatados.`);
        return summarizedAssets;
    }
}

export { ListAllAssetsUseCase };

