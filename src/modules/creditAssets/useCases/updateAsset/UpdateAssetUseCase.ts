import { PrismaClient, CreditAsset, User } from "@prisma/client";
const prisma = new PrismaClient();

// 1. ATUALIZAÇÃO DA INTERFACE
interface InvestorInput { 
    userId: User['id']; 
    share?: number; 
    associateId?: string | null;
    acquisitionDate?: Date | null;
}

type IUpdateAssetDTO = {
    processNumber: string; 
    acquisitionValue?: number;
    originalValue?: number;
    acquisitionDate?: Date;
    associateId?: string | null;
    updateIndexType?: string;
    contractualIndexRate?: number | null;
    
    nickname?: string | null;
    otherParty?: string | null;

    investors?: InvestorInput[]; 
};

class UpdateAssetUseCase {
    async execute(data: IUpdateAssetDTO): Promise<CreditAsset> {
        const { processNumber, investors, ...assetUpdateData } = data;

        // 2. INCLUI OS INVESTIDORES NA BUSCA PARA PODERMOS COMPARAR
        const asset = await prisma.creditAsset.findUnique({ 
            where: { processNumber },
            include: { investors: true } 
        });
        
        if (!asset) throw new Error("Ativo não encontrado.");
        
        const updatedAsset = await prisma.$transaction(async (tx) => {
            const updatedAssetTx = await tx.creditAsset.update({
                where: { id: asset.id },
                data: { ...assetUpdateData } 
            });

            if (investors && investors.length > 0) {
                const totalShare = investors.reduce((sum, i) => sum + (Number(i.share) || 0), 0);
                const mazzotiniShare = 100 - totalShare;

                // 3. LÓGICA DE UPSERT (NÃO APAGA OS DOCUMENTOS DO INVESTIDOR!)
                const incomingUserIds = investors.map(i => i.userId);

                // A) Apaga apenas quem foi removido na interface
                await tx.investment.deleteMany({
                    where: {
                        creditAssetId: asset.id,
                        userId: { notIn: incomingUserIds }
                    }
                });

                // B) Cria ou Atualiza quem ficou
                for (let idx = 0; idx < investors.length; idx++) {
                    const inv = investors[idx];
                    const existingInvestment = asset.investors.find(c => c.userId === inv.userId);

                    const calculatedMazzotiniShare = idx === 0 ? mazzotiniShare : 0;

                    if (existingInvestment) {
                        // Atualiza o existente (preservando o ID e a array de 'documents')
                        await tx.investment.update({
                            where: { id: existingInvestment.id },
                            data: {
                                investorShare: inv.share || 0,
                                mazzotiniShare: calculatedMazzotiniShare,
                                associateId: inv.associateId || null,
                                acquisitionDate: inv.acquisitionDate || null
                            }
                        });
                    } else {
                        // Cria um novo se o usuário foi adicionado agora
                        await tx.investment.create({
                            data: {
                                creditAssetId: asset.id,
                                userId: inv.userId,
                                investorShare: inv.share || 0,
                                mazzotiniShare: calculatedMazzotiniShare,
                                associateId: inv.associateId || undefined,
                                acquisitionDate: inv.acquisitionDate || undefined
                            }
                        });
                    }
                }
            } else if (investors && investors.length === 0) {
                // Caso mandem um array vazio, limpamos tudo
                await tx.investment.deleteMany({ where: { creditAssetId: asset.id } });
            }
            
            return updatedAssetTx; 
        });
        
        return updatedAsset;
    }
}
export { UpdateAssetUseCase };