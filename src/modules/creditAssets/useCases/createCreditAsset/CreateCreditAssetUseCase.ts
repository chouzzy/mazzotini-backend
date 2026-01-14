import { PrismaClient, CreditAsset, User } from "@prisma/client";
import { EnrichAssetFromLegalOneUseCase } from "../enrichAssetFromLegalOne/EnrichAssetFromLegalOneUseCase"; 

const prisma = new PrismaClient();

interface InvestorInput {
    userId: User['id'];
    share?: number;
}

type ICreateCreditAssetDTO =
    Pick<CreditAsset,
        'processNumber' |
        'originalCreditor' |
        'origemProcesso' |    
        'legalOneId' |        
        'legalOneType' |      
        'originalValue' |
        'acquisitionValue' |
        'acquisitionDate' |
        'updateIndexType' |
        'contractualIndexRate' |
        'nickname' // <-- NOVO
    > & {
        investors: InvestorInput[]; 
        associateId?: User['id'] | null;
    };


class CreateCreditAssetUseCase {
    async execute(data: ICreateCreditAssetDTO): Promise<CreditAsset> {

        const {
            processNumber,
            investors, 
            associateId,
            ...assetData 
        } = data;

        const assetAlreadyExists = await prisma.creditAsset.findFirst({
            where: { 
                OR: [
                    { processNumber: processNumber },
                    { legalOneId: assetData.legalOneId } 
                ]
            },
        });

        if (assetAlreadyExists) {
            throw new Error(`Já existe um ativo de crédito com este Número de Processo (${processNumber}) ou ID Legal One (${assetData.legalOneId}).`);
        }

        if (associateId) {
            const associateExists = await prisma.user.findUnique({ where: { id: associateId } });
            if (!associateExists) throw new Error("O associado selecionado não foi encontrado.");
        }
        
        const investorUserIds = investors.map(inv => inv.userId);
        const uniqueInvestorIds = new Set(investorUserIds);
        if (uniqueInvestorIds.size !== investorUserIds.length) {
            throw new Error("Não é permitido adicionar o mesmo investidor duas vezes ao processo.");
        }

        const totalShare = investors.reduce((sum, investor) => sum + (Number(investor.share) || 0), 0);
        if (totalShare < 0 || totalShare > 100) {
             throw new Error(`A soma das participações dos investidores (${totalShare}%) é inválida.`);
        }
        const mazzotiniShare = 100 - totalShare;

        const newCreditAsset = await prisma.$transaction(async (tx) => {
            
            const createdAsset = await tx.creditAsset.create({
                data: {
                    ...assetData, 
                    processNumber: processNumber,
                    status: 'PENDING_ENRICHMENT',
                    currentValue: assetData.originalValue, 
                    associateId: associateId || null,
                    // nickname já vem no ...assetData
                },
            });

            const investmentData = investors.map(investor => {
                return {
                    investorShare: investor.share || 0,
                    mazzotiniShare: 0, 
                    userId: investor.userId,
                    creditAssetId: createdAsset.id,
                };
            });

            if (investmentData.length > 0) {
                 investmentData[0].mazzotiniShare = mazzotiniShare;
            }

            await tx.investment.createMany({
                data: investmentData
            });

            console.log(`✅ Ativo criado: ${createdAsset.processNumber} (${createdAsset.nickname || 'Sem apelido'})`);

            return createdAsset;
        });

        const enrichUseCase = new EnrichAssetFromLegalOneUseCase();
        enrichUseCase.execute(newCreditAsset.id).catch(err => console.error(err));

        return newCreditAsset;
    }
}

export { CreateCreditAssetUseCase };