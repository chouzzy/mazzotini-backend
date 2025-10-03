// /src/modules/creditAssets/useCases/syncSingleAsset/SyncSingleAssetUseCase.ts
import { PrismaClient } from "@prisma/client";
import { legalOneApiService, LegalOneUpdate } from "../../../../services/legalOneApiService";
import { extractAllValues, extractFreeText } from "../../../../utils/utils";

const prisma = new PrismaClient();

/**
 * Tenta extrair todos os valores monetários de uma string de texto.
 */

/**
 * Extrai apenas o texto descritivo do andamento, ignorando a tag #SM e os campos de valor.
 */


class SyncSingleAssetUseCase {
    async execute(processNumber: string): Promise<void> {
        console.log(`[SYNC MANUAL] Iniciando sincronização para o processo: ${processNumber}`);

        const asset = await prisma.creditAsset.findUnique({
            where: { processNumber },
            include: { updates: { select: { description: true, date: true } } }
        });

        if (!asset) {
            throw new Error("Ativo não encontrado na base de dados local.");
        }

        try {
            const lawsuitData = await legalOneApiService.getProcessDetails(asset.processNumber);
            const legalOneUpdates = await legalOneApiService.getProcessUpdates(lawsuitData.id);

            const existingUpdates = new Set(asset.updates.map(u => `${u.description}-${new Date(u.date).toISOString()}`));
            
            const newUpdates = legalOneUpdates.filter(update => {
                const uniqueKey = `${update.description}-${new Date(update.date).toISOString()}`;
                return !existingUpdates.has(uniqueKey);
            });

            if (newUpdates.length === 0) {
                console.log(`[SYNC MANUAL] Processo ${asset.processNumber}: Nenhum novo andamento encontrado.`);
                return;
            }

            console.log(`[SYNC MANUAL] Processo ${asset.processNumber}: ${newUpdates.length} novo(s) andamento(s) encontrado(s)!`);
            
            const sortedNewUpdates = newUpdates.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            await prisma.$transaction(async (tx) => {
                let currentAssetValues = {
                    originalValue: asset.originalValue,
                    acquisitionValue: asset.acquisitionValue,
                    currentValue: asset.currentValue,
                };

                for (const update of sortedNewUpdates) {
                    const allValues = extractAllValues(update.description);
                    console.log('Valores extraídos:', allValues);
                    const updateText = extractFreeText(update.description);

                    if (allValues.valorDaCausa !== null) {
                        currentAssetValues.originalValue = allValues.valorDaCausa;
                    }
                    if (allValues.valorDaCompra !== null) {
                        currentAssetValues.acquisitionValue = allValues.valorDaCompra;
                    }
                    if (allValues.valorAtualizado !== null) {
                        currentAssetValues.currentValue = allValues.valorAtualizado;
                    }

                    await tx.assetUpdate.create({
                        data: {
                            assetId: asset.id,
                            date: new Date(update.date),
                            description: update.description,
                            updatedValue: allValues.valorAtualizado ?? currentAssetValues.currentValue,
                            source: `Legal One - ${update.originType}`,
                        }
                    });
                }
                console.log('Valores finais do ativo após atualizações:', currentAssetValues);
                await tx.creditAsset.update({
                    where: { id: asset.id },
                    data: {
                        originalValue: currentAssetValues.originalValue,
                        acquisitionValue: currentAssetValues.acquisitionValue,
                        currentValue: currentAssetValues.currentValue,
                    }
                });
            });

            console.log(`✅ Ativo ${asset.id} (manual) sincronizado com ${newUpdates.length} novos andamentos!`);

        } catch (error: any) {
            console.error(`[SYNC MANUAL] Erro ao sincronizar o processo ${asset.processNumber}:`, error.message);
            // Lança o erro para que o controller possa capturá-lo e notificar o frontend.
            throw new Error(`Falha ao sincronizar: ${error.message}`);
        }
    }
}

export { SyncSingleAssetUseCase };

