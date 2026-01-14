import { PrismaClient, CreditAsset, User } from "@prisma/client";

const prisma = new PrismaClient();

interface InvestorInput {
    userId: User['id'];
    share?: number;
}

type IUpdateAssetDTO = {
    processNumber: string; 
    
    acquisitionValue?: number;
    originalValue?: number;
    acquisitionDate?: Date;
    associateId?: string | null;
    updateIndexType?: string;
    contractualIndexRate?: number | null;
    
    // NOVO
    nickname?: string | null;

    investors?: InvestorInput[]; 
};

class UpdateAssetUseCase {

    async execute(data: IUpdateAssetDTO): Promise<CreditAsset> {
        const { 
            processNumber, 
            investors,
            ...assetUpdateData 
        } = data;

        const asset = await prisma.creditAsset.findUnique({
            where: { processNumber },
        });

        if (!asset) {
            throw new Error("Ativo de crédito não encontrado.");
        }
        
        const updatedAsset = await prisma.$transaction(async (tx) => {
            
            // Atualiza os dados do Ativo (incluindo o nickname)
            const updatedAssetTx = await tx.creditAsset.update({
                where: { id: asset.id },
                data: {
                    ...assetUpdateData, 
                }
            });

            if (investors) {
                // (Lógica de Nuke and Pave dos investidores - Mantida igual)
                const investorUserIds = investors.map(inv => inv.userId);
                const uniqueInvestorIds = new Set(investorUserIds);
                if (uniqueInvestorIds.size !== investorUserIds.length) {
                    throw new Error("Não é permitido adicionar o mesmo investidor duas vezes ao processo.");
                }

                const totalShare = investors.reduce((sum, investor) => sum + (Number(investor.share) || 0), 0);
                const mazzotiniShare = 100 - totalShare;

                await tx.investment.deleteMany({ where: { creditAssetId: asset.id } });

                const investmentData = investors.map(investor => ({
                        investorShare: investor.share || 0,
                        mazzotiniShare: 0,
                        userId: investor.userId,
                        creditAssetId: asset.id, 
                }));

                if (investmentData.length > 0) investmentData[0].mazzotiniShare = mazzotiniShare;

                await tx.investment.createMany({ data: investmentData });
            }

            return updatedAssetTx; 
        });

        console.log(`[UpdateAsset] Ativo ${updatedAsset.id} (${processNumber}) atualizado.`);
        return updatedAsset;
    }
}

export { UpdateAssetUseCase };