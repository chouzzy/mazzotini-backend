// src/modules/creditAssets/useCases/updateAsset/UpdateAssetUseCase.ts
import { PrismaClient, CreditAsset } from "@prisma/client";

const prisma = new PrismaClient();

// DTO de Update (completo, como vem do controller)
type IUpdateAssetDTO = {
    processNumber: string; 
    
    // Campos do CreditAsset
    acquisitionValue?: number;
    originalValue?: number;
    acquisitionDate?: Date;
    associateId?: string | null;
    updateIndexType?: string;
    contractualIndexRate?:  number | null;
    
    // Campos do Investment
    investorId?: string; 
    investorShare?: number; 
};

class UpdateAssetUseCase {

    async execute(data: IUpdateAssetDTO): Promise<CreditAsset> {
        const { 
            processNumber, 
            investorId, 
            investorShare, 
            ...assetUpdateData // O resto (acquisitionValue, updateIndexType, etc.)
        } = data;

        // 1. Encontra o ativo pelo número do processo
        const asset = await prisma.creditAsset.findUnique({
            where: { processNumber },
        });

        if (!asset) {
            throw new Error("Ativo de crédito não encontrado com este número de processo.");
        }
        
        // =================================================================
        //  A CORREÇÃO (A TRANSAÇÃO)
        // =================================================================
        // Usamos uma transação para atualizar o Ativo E o Investimento
        const updatedAsset = await prisma.$transaction(async (tx) => {
            
            // 2. Atualiza os dados do Ativo (CreditAsset)
            const updatedAssetTx = await tx.creditAsset.update({
                where: { id: asset.id },
                data: {
                    ...assetUpdateData, // Salva os campos do CreditAsset
                }
            });

            // 3. Atualiza os dados do Investimento (Investment)
            // Se o usuário mudou o investidor ou a participação...
            if (investorId || (typeof investorShare === 'number')) {
                
                // Encontra o registro de investimento existente
                const currentInvestment = await tx.investment.findFirst({
                    where: { creditAssetId: asset.id }
                });

                if (currentInvestment) {
                    // Atualiza o registro de investimento
                    await tx.investment.update({
                        where: { id: currentInvestment.id },
                        data: {
                            userId: investorId || currentInvestment.userId, // Atualiza o ID do investidor (se enviado)
                            investorShare: investorShare || currentInvestment.investorShare, // Atualiza o share (se enviado)
                            // Não mexemos no mazzotiniShare, como você pediu
                        }
                    });
                } else if (investorId) {
                    // (Fallback) Se por algum motivo não havia um 'Investment', cria um.
                    await tx.investment.create({
                        data: {
                            creditAssetId: asset.id,
                            userId: investorId,
                            investorShare: investorShare || 0,
                            mazzotiniShare: 100 - (investorShare || 0) // (Aqui precisamos calcular, pois é 'create')
                        }
                    });
                }
            }

            return updatedAssetTx; // Retorna o ativo atualizado
        });

        console.log(`[UpdateAsset] Ativo ${updatedAsset.id} (${processNumber}) e seu Investimento associado foram atualizados com sucesso.`);
        return updatedAsset;
    }
}

export { UpdateAssetUseCase };