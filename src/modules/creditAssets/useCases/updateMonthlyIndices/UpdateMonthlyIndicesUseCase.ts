// src/modules/creditAssets/useCases/updateMonthlyIndices/UpdateMonthlyIndicesUseCase.ts
import { PrismaClient } from "@prisma/client";
import { economicIndexService } from "../../../../services/economicIndexService";

const prisma = new PrismaClient();

/**
 * Helper para formatar YYYY-MM-DD
 */
const formatAsISO = (date: Date): string => {
    return date.toISOString().split('T')[0];
}

class UpdateMonthlyIndicesUseCase {

    /**
     * Este UseCase é projetado para ser chamado por um Cron (ex: todo dia 1º do mês).
     * Ele busca TODOS os ativos 'Ativos', calcula a correção do mês anterior e atualiza o currentValue.
     */
    async execute(): Promise<void> {
        console.log(`[Cron:UpdateIndices] Iniciando tarefa de atualização monetária mensal...`);

        // 1. Definir o período de cálculo
        // Queremos calcular o índice do mês que *acabou de fechar*.
        const today = new Date();
        const firstDayOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        
        // Data de início é o primeiro dia do mês passado
        const startDate = new Date(firstDayOfThisMonth);
        startDate.setMonth(startDate.getMonth() - 1); // Ex: 01/10/2025

        // Data de fim é o último dia do mês passado
        const endDate = new Date(firstDayOfThisMonth);
        endDate.setDate(endDate.getDate() - 1); // Ex: 31/10/2025

        console.log(`[Cron:UpdateIndices] Período de cálculo: ${formatAsISO(startDate)} a ${formatAsISO(endDate)}`);

        // 2. Buscar todos os ativos que precisam de atualização
        const assetsToUpdate = await prisma.creditAsset.findMany({
            where: {
                status: 'Ativo', // Só atualiza ativos que já foram enriquecidos
                NOT: {
                    updateIndexType: null // Ignora os que não têm índice
                },
                AND: {
                    NOT: {
                        updateIndexType: 'Outro' // Ignora os que têm índice 'Outro'
                    }
                }
            }
        });

        if (assetsToUpdate.length === 0) {
            console.log("[Cron:UpdateIndices] Nenhum ativo 'Ativo' com índice para atualizar.");
            return;
        }

        console.log(`[Cron:UpdateIndices] ${assetsToUpdate.length} ativos encontrados para atualização.`);

        // 3. Buscar os índices (SELIC, IPCA, etc.) do mês passado
        // Fazemos isso em paralelo para economizar tempo
        const indexTypes = [...new Set(assetsToUpdate.map(a => a.updateIndexType! as any))];
        const indexFactors = new Map<string, number>();

        await Promise.all(indexTypes.map(async (indexType) => {
            const factor = await economicIndexService.getMonthlyIndexSeries(indexType, startDate, endDate);
            
            let monthFactor = 1.0; // Fator 1.0 = 0% de correção
            
            if (factor.length > 0) {
                // O valor vem ex: 0.86 (para 0.86%). Dividimos por 100 e somamos 1.
                monthFactor = 1 + (factor[0].value / 100);
            } else {
                 console.warn(`[Cron:UpdateIndices] Não foi encontrado valor do ${indexType} para ${formatAsISO(startDate)}. Usando 0% (fator 1.0).`);
            }
            
            indexFactors.set(indexType, monthFactor);
            console.log(`[Cron:UpdateIndices] Fator ${indexType} para o mês: ${monthFactor}`);
        }));

        // 4. Iterar e atualizar cada ativo
        for (const asset of assetsToUpdate) {
            try {
                // Pega os fatores de correção
                const bcbFactor = indexFactors.get(asset.updateIndexType!) || 1.0;
                const contractualRateMonthly = (asset.contractualIndexRate || 0) / 100; // Ex: 1% -> 0.01

                // Pega o valor atual como ponto de partida
                const currentValue = asset.currentValue;

                // Calcula o novo valor
                const newValue = currentValue * bcbFactor * (1 + contractualRateMonthly);

                // Prepara a descrição para o histórico (AssetUpdate)
                const description = `Correção automática: ${asset.updateIndexType} (${((bcbFactor - 1) * 100).toFixed(4)}%) + Taxa (${contractualRateMonthly * 100}%)`;

                // 5. Salvar em uma transação
                await prisma.$transaction(async (tx) => {
                    // 5.1. Salva o novo Andamento
                    await tx.assetUpdate.create({
                        data: {
                            assetId: asset.id,
                            legalOneUpdateId: null, // É um andamento interno, não do Legal One
                            date: today,
                            description: description,
                            updatedValue: newValue,
                            source: 'Sistema - Correção Mensal',
                        }
                    });

                    // 5.2. Atualiza o valor principal do Ativo
                    await tx.creditAsset.update({
                        where: { id: asset.id },
                        data: {
                            currentValue: newValue
                        }
                    });
                });
                
                console.log(`[Cron:UpdateIndices] Ativo ${asset.id} (${asset.processNumber}) atualizado para R$ ${newValue.toFixed(2)}`);

            } catch (err: any) {
                 console.error(`[Cron:UpdateIndices] FALHA ao atualizar o ativo ${asset.id}: ${err.message}`);
                 // Não para o loop, continua para o próximo ativo
            }
        }

        console.log(`[Cron:UpdateIndices] Tarefa de atualização monetária concluída.`);
    }
}

export { UpdateMonthlyIndicesUseCase };