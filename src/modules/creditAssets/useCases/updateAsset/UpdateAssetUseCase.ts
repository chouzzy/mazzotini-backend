// src/modules/creditAssets/useCases/updateAsset/UpdateAssetUseCase.ts
import { PrismaClient, CreditAsset, User } from "@prisma/client";

const prisma = new PrismaClient();

// Interface para o array de investidores que vem do frontend
interface InvestorInput {
    userId: User['id'];
    share?: number; // Share é opcional
}

// DTO de Update (completo, como vem do controller)
type IUpdateAssetDTO = {
    processNumber: string; 
    
    // Campos do CreditAsset
    acquisitionValue?: number;
    originalValue?: number;
    acquisitionDate?: Date;
    associateId?: string | null;
    updateIndexType?: string;
    contractualIndexRate?: number | null;
    
    // Campos do Investment (agora um array opcional)
    investors?: InvestorInput[]; 
};


class UpdateAssetUseCase {

    async execute(data: IUpdateAssetDTO): Promise<CreditAsset> {
        const { 
            processNumber, 
            investors, // O novo array de investidores
            ...assetUpdateData // O resto (acquisitionValue, updateIndexType, etc.)
        } = data;

        // 1. Encontra o ativo pelo número do processo
        const asset = await prisma.creditAsset.findUnique({
            where: { processNumber },
        });

        if (!asset) {
            throw new Error("Ativo de crédito não encontrado com este número de processo.");
        }
        
        // 2. Transação de "Reconciliação"
        const updatedAsset = await prisma.$transaction(async (tx) => {
            
            // 2.1. Atualiza os dados do Ativo (CreditAsset)
            const updatedAssetTx = await tx.creditAsset.update({
                where: { id: asset.id },
                data: {
                    ...assetUpdateData, // Salva os campos do CreditAsset
                }
            });

            // 3. RECONCILIA OS INVESTIMENTOS (Só se o array 'investors' foi enviado)
            if (investors) {
                console.log(`[UpdateAsset] Reconciliando ${investors.length} investidores...`);

                // =================================================================
                //  A SUA CORREÇÃO (Validação de Duplicidade no Backend)
                // =================================================================
                const investorUserIds = investors.map(inv => inv.userId);
                const uniqueInvestorIds = new Set(investorUserIds);

                if (uniqueInvestorIds.size !== investorUserIds.length) {
                    console.error("[UpdateAsset] Tentativa de atualização com investidores duplicados.", investorUserIds);
                    throw new Error("Não é permitido adicionar o mesmo investidor duas vezes ao processo.");
                }
                // =================================================================

                // // 3.2 Validação (Soma 0%)
                // const totalShare = investors.reduce((sum, investor) => sum + (Number(investor.share) || 0), 0);
                // if (totalShare < 0 || totalShare > 100) {
                //      throw new Error(`A soma das participações dos investidores (${totalShare}%) é inválida.`);
                // }
                // const mazzotiniShare = 100 - totalShare; // (Vai dar 100)

                // 3.3 "Nuke and Pave": Apaga TODOS os 'Investment' antigos
                await tx.investment.deleteMany({
                    where: { creditAssetId: asset.id }
                });

                // 3.4 Prepara os novos dados
                const investmentData = investors.map(investor => {
                    if (!investor.userId) {
                        throw new Error("Dados de investidor inválidos no array.");
                    }
                    return {
                        investorShare: investor.share || 0, // <-- Usa o share enviado (que será 0)
                        mazzotiniShare: 0, 
                        userId: investor.userId,
                        creditAssetId: asset.id, 
                    };
                });

                // 3.5 Armazena o 'mazzotiniShare' no primeiro investidor da lista
                if (investmentData.length > 0) {
                     investmentData[0].mazzotiniShare = 0;
                }

                // 3.6 Cria TODOS os novos 'Investment'
                await tx.investment.createMany({
                    data: investmentData
                });
                
                console.log(`[UpdateAsset] Investimentos para ${asset.id} foram substituídos com sucesso.`);
            }

            return updatedAssetTx; // Retorna o ativo atualizado
        });

        console.log(`[UpdateAsset] Ativo ${updatedAsset.id} (${processNumber}) atualizado com sucesso.`);
        return updatedAsset;
    }
}

export { UpdateAssetUseCase };