// src/modules/creditAssets/useCases/createCreditAsset/CreateCreditAssetUseCase.ts
import { PrismaClient, CreditAsset, User } from "@prisma/client";
import { EnrichAssetFromLegalOneUseCase } from "../enrichAssetFromLegalOne/EnrichAssetFromLegalOneUseCase"; 

const prisma = new PrismaClient();

// Interface para o array de investidores que vem do frontend
interface InvestorInput {
    userId: User['id'];
    share?: number;
}

// O DTO (Data Transfer Object) agora espera 'investors' (array)
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
        'updateIndexType'
    > & {
        contractualIndexRate?: number | null;
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

        // 1. Validação: Verifica se o ativo já existe
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

        // 2. Validação: Se um associateId foi fornecido, verifica se ele existe
        if (associateId) {
            const associateExists = await prisma.user.findUnique({
                where: { id: associateId }
            });
            if (!associateExists) {
                throw new Error("O associado selecionado não foi encontrado no sistema.");
            }
        }
        
        // =================================================================
        //  A SUA CORREÇÃO (Validação de Duplicidade no Backend)
        // =================================================================
        const investorUserIds = investors.map(inv => inv.userId);
        const uniqueInvestorIds = new Set(investorUserIds);

        if (uniqueInvestorIds.size !== investorUserIds.length) {
            console.error("[CreateAsset] Tentativa de criação de ativo com investidores duplicados.", investorUserIds);
            throw new Error("Não é permitido adicionar o mesmo investidor duas vezes ao processo.");
        }
        // =================================================================

        // // 4. Validação (Soma 0%)
        // const totalShare = investors.reduce((sum, investor) => sum + (Number(investor.share) || 0), 0);
        // if (totalShare < 0 || totalShare > 100) {
        //      throw new Error(`A soma das participações dos investidores (${totalShare}%) é inválida.`);
        // }
        // const mazzotiniShare = 100 - totalShare;

        // 5. Criação Atómica com Transação
        const newCreditAsset = await prisma.$transaction(async (tx) => {
            
            // 5.1. Cria o ativo
            const createdAsset = await tx.creditAsset.create({
                data: {
                    ...assetData, 
                    processNumber: processNumber,
                    status: 'PENDING_ENRICHMENT',
                    currentValue: assetData.originalValue, 
                    associateId: associateId || null
                },
            });

            // 5.2. Prepara os dados para TODOS os investimentos
            const investmentData = investors.map(investor => {
                if (!investor.userId) {
                    throw new Error("Dados de investidor inválidos no array.");
                }
                return {
                    investorShare: investor.share || 0, // Garante 0% se for nulo
                    mazzotiniShare: 0, 
                    userId: investor.userId,
                    creditAssetId: createdAsset.id,
                };
            });

            if (investmentData.length > 0) {
                 investmentData[0].mazzotiniShare = 0;
            }

            // 5.3. Cria MÚLTIPLOS registos de investimento
            await tx.investment.createMany({
                data: investmentData
            });

            console.log(`✅ Ativo e ${investmentData.length} investimento(s) criados para o processo ${createdAsset.processNumber}`);

            return createdAsset;
        });

        // 6. Dispara o enriquecimento em segundo plano (sem mudanças)
        const enrichUseCase = new EnrichAssetFromLegalOneUseCase();
        enrichUseCase.execute(newCreditAsset.id)
            .catch(err => {
                console.error(`[Enrich-Trigger] Falha ao iniciar enriquecimento para ${newCreditAsset.id}:`, err.message);
            });

        return newCreditAsset;
    }
}

export { CreateCreditAssetUseCase };