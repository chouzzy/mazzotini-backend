import { PrismaClient } from "@prisma/client";
import { legalOneApiService, LegalOneUpdate } from "../../../../services/legalOneApiService";

const prisma = new PrismaClient();

/**
 * Tenta extrair um valor monetário de uma string de anotações.
 * Hipótese: o formato será "Valor: R$ 12.345,67".
 */
const parseValueFromNotes = (notes: string | null): number | null => {
    if (!notes) return null;
    const valueMatch = notes.match(/Valor:\s*R\$\s*([\d.,]+)/i);
    if (valueMatch && valueMatch[1]) {
        // Converte o formato brasileiro (1.234,56) para um número
        const numericString = valueMatch[1].replace(/\./g, '').replace(',', '.');
        return parseFloat(numericString);
    }
    return null;
};

/**
 * @class SyncProcessUpdatesUseCase
 * @description Lógica de negócio para buscar e sincronizar novos andamentos para todos os ativos ativos.
 */
class SyncProcessUpdatesUseCase {
    async execute(): Promise<void> {
        console.log(`[CRON JOB] Iniciando a sincronização de andamentos...`);

        // 1. Busca todos os ativos que não estão liquidados ou com falha.
        const activeAssets = await prisma.creditAsset.findMany({
            where: {
                status: 'Ativo' // Ou poderíamos incluir 'Em Negociação', etc.
            },
            include: {
                // Incluímos os updates existentes para evitar duplicatas
                updates: {
                    select: {
                        description: true,
                        date: true,
                    }
                }
            }
        });

        if (activeAssets.length === 0) {
            console.log("[CRON JOB] Nenhum ativo ativo encontrado para sincronizar.");
            return;
        }

        console.log(`[CRON JOB] ${activeAssets.length} ativos encontrados para verificação.`);

        // 2. Itera sobre cada ativo para verificar por novas atualizações.
        for (const asset of activeAssets) {
            try {
                // Busca o ID do Lawsuit no Legal One para poder buscar os andamentos
                const lawsuitData = await legalOneApiService.getProcessDetails(asset.processNumber);
                if (!lawsuitData) continue;

                const legalOneUpdates = await legalOneApiService.getProcessUpdates(lawsuitData.id);

                // Criamos um "carimbo" único para cada andamento já salvo, para evitar duplicatas
                const existingUpdates = new Set(asset.updates.map(u => `${u.description}-${new Date(u.date).toISOString()}`));
                
                // Filtramos a lista do Legal One, pegando apenas os que não temos no nosso banco
                const newUpdates = legalOneUpdates.filter(update => 
                    !existingUpdates.has(`${update.description}-${new Date(update.date).toISOString()}`)
                );

                if (newUpdates.length === 0) {
                    console.log(`[CRON JOB] Processo ${asset.processNumber}: Nenhum novo andamento encontrado.`);
                    continue;
                }

                console.log(`[CRON JOB] Processo ${asset.processNumber}: ${newUpdates.length} novo(s) andamento(s) encontrado(s)!`);

                let latestCurrentValue = asset.currentValue;

                // Salva os novos andamentos no nosso banco
                for (const update of newUpdates) {
                     const extractedValue = parseValueFromNotes(update.notes);
                    
                    if (extractedValue !== null) {
                        latestCurrentValue = extractedValue;
                    }

                    await prisma.assetUpdate.create({
                        data: {
                            assetId: asset.id,
                            date: new Date(update.date),
                            description: update.description,
                            updatedValue: extractedValue || latestCurrentValue, // Usa o valor extraído ou o último conhecido
                            source: `Legal One - ${update.originType}`,
                        }
                    });
                }
                
                // Atualiza o valor atual do ativo se um novo valor foi encontrado
                if (latestCurrentValue !== asset.currentValue) {
                    await prisma.creditAsset.update({
                        where: { id: asset.id },
                        data: { currentValue: latestCurrentValue }
                    });
                }

            } catch (error: any) {
                console.error(`[CRON JOB] Erro ao sincronizar o processo ${asset.processNumber}:`, error.message);
                // Continua para o próximo ativo em caso de erro em um
                continue;
            }
        }
        console.log(`[CRON JOB] Sincronização de andamentos concluída.`);
    }
}

export { SyncProcessUpdatesUseCase };

