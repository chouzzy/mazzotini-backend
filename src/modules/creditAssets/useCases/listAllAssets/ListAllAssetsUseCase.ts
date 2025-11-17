// /src/modules/creditAssets/useCases/listAllAssets/ListAllAssetsUseCase.ts
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ROLES = {
    ADMIN: process.env.ROLE_ADMIN || 'ADMIN',
    OPERATOR: process.env.ROLE_OPERATOR || 'OPERATOR',
    INVESTOR: process.env.ROLE_INVESTOR || 'INVESTOR',
    ASSOCIATE: process.env.ROLE_ASSOCIATE || 'ASSOCIATE',
};

// Tipagem para o retorno (sem mudanças)
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
    investorShare: number;
    investedValue: number;
    updateIndexType: string | null;
};

// O Payload do Prisma (sem mudanças)
const assetWithInvestorPayload = {
    include: { 
        investors: { 
            take: 1, 
            include: { 
                user: { // Agora que o schema é 'User?', isto retornará 'null' em vez de quebrar
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
        let isAdminOrOperator = false; 

        // 1. BUSCA (A sua lógica, que já está correta)
        switch (primaryRole) {
            case ROLES.ADMIN:
            case ROLES.OPERATOR:
                isAdminOrOperator = true; 
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
        
        // =================================================================
        //  A CORREÇÃO (Mapeamento Defensivo)
        // =================================================================
        const summarizedAssets = assets.map(asset => {
            
            // 2. A CORREÇÃO: 'mainInvestment' pode ser 'undefined' (se 'investors' for [])
            const mainInvestment = asset.investors?.[0]; 

            const investorShare = mainInvestment?.investorShare || 0;
            let investedValue = 0;

            if (isAdminOrOperator) {
                investedValue = asset.acquisitionValue;
            } else {
                investedValue = asset.acquisitionValue * (investorShare / 100);
            }

            return {
                id: asset.id,
                processNumber: asset.processNumber,
                originalCreditor: asset.originalCreditor,
                currentValue: asset.currentValue,
                status: asset.status,
                acquisitionDate: asset.acquisitionDate,
                
                // 3. A CORREÇÃO: Adicionamos '?' para verificar se 'user' não é 'null'
                mainInvestorName: mainInvestment?.user?.name || 'N/A', 
                investorId: mainInvestment?.user?.id || null, 
                
                associateId: asset.associateId || null,
                
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