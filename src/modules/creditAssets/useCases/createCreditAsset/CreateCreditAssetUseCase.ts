import { PrismaClient, CreditAsset, User } from "@prisma/client";
import { EnrichAssetFromLegalOneUseCase } from "../enrichAssetFromLegalOne/EnrichAssetFromLegalOneUseCase"; 

const prisma = new PrismaClient();

interface InvestorInput { userId: User['id']; share?: number; }

type ICreateCreditAssetDTO = Pick<CreditAsset, 'processNumber' | 'originalCreditor' | 'origemProcesso' | 'legalOneId' | 'legalOneType' | 'originalValue' | 'acquisitionValue' | 'acquisitionDate' | 'updateIndexType' | 'contractualIndexRate' | 'nickname' | 'otherParty'> & { // <--- Adicionado otherParty
    investors: InvestorInput[]; 
    associateId?: User['id'] | null;
};

class CreateCreditAssetUseCase {
    async execute(data: ICreateCreditAssetDTO): Promise<CreditAsset> {
        const { processNumber, investors, associateId, ...assetData } = data;

        // ... (Validações mantidas)
        const assetAlreadyExists = await prisma.creditAsset.findFirst({
            where: { OR: [{ processNumber }, { legalOneId: assetData.legalOneId }] },
        });
        if (assetAlreadyExists) throw new Error(`Já existe um ativo com este Processo ou ID Legal One.`);
        
        const totalShare = investors.reduce((sum, i) => sum + (Number(i.share) || 0), 0);
        const mazzotiniShare = 100 - totalShare;

        const newCreditAsset = await prisma.$transaction(async (tx) => {
            const createdAsset = await tx.creditAsset.create({
                data: {
                    ...assetData, // Já inclui otherParty e nickname
                    processNumber,
                    status: 'PENDING_ENRICHMENT',
                    currentValue: assetData.originalValue, 
                    associateId: associateId || null,
                },
            });

            if (investors.length > 0) {
                await tx.investment.createMany({
                    data: investors.map((inv, idx) => ({
                        investorShare: inv.share || 0,
                        mazzotiniShare: idx === 0 ? mazzotiniShare : 0,
                        userId: inv.userId,
                        creditAssetId: createdAsset.id,
                    }))
                });
            }
            return createdAsset;
        });

        const enrichUseCase = new EnrichAssetFromLegalOneUseCase();
        enrichUseCase.execute(newCreditAsset.id).catch(console.error);

        return newCreditAsset;
    }
}
export { CreateCreditAssetUseCase };