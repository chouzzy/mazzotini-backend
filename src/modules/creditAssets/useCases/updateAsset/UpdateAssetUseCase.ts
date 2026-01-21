import { PrismaClient, CreditAsset, User } from "@prisma/client";
const prisma = new PrismaClient();

interface InvestorInput { userId: User['id']; share?: number; }

type IUpdateAssetDTO = {
    processNumber: string; 
    acquisitionValue?: number;
    originalValue?: number;
    acquisitionDate?: Date;
    associateId?: string | null;
    updateIndexType?: string;
    contractualIndexRate?: number | null;
    
    nickname?: string | null;
    otherParty?: string | null; // <--- NOVO

    investors?: InvestorInput[]; 
};

class UpdateAssetUseCase {
    async execute(data: IUpdateAssetDTO): Promise<CreditAsset> {
        const { processNumber, investors, ...assetUpdateData } = data;

        const asset = await prisma.creditAsset.findUnique({ where: { processNumber } });
        if (!asset) throw new Error("Ativo não encontrado.");
        
        const updatedAsset = await prisma.$transaction(async (tx) => {
            const updatedAssetTx = await tx.creditAsset.update({
                where: { id: asset.id },
                data: { ...assetUpdateData } // otherParty incluído aqui
            });

            if (investors) {
                // ... (Lógica de Nuke and Pave dos investidores mantida)
                const totalShare = investors.reduce((sum, i) => sum + (Number(i.share) || 0), 0);
                const mazzotiniShare = 100 - totalShare;

                await tx.investment.deleteMany({ where: { creditAssetId: asset.id } });
                await tx.investment.createMany({
                    data: investors.map((inv, idx) => ({
                        userId: inv.userId,
                        investorShare: inv.share || 0,
                        mazzotiniShare: idx === 0 ? mazzotiniShare : 0,
                        creditAssetId: asset.id, 
                    }))
                });
            }
            return updatedAssetTx; 
        });
        return updatedAsset;
    }
}
export { UpdateAssetUseCase };