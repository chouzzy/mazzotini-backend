// /src/modules/creditAssets/useCases/syncProcessUpdates/SyncProcessUpdatesUseCase.ts
import { PrismaClient } from "@prisma/client";
import { legalOneApiService } from "../../../../services/legalOneApiService";

const prisma = new PrismaClient();

/**
 * Tenta extrair todos os valores monetários de uma string de texto.
 */
const extractAllValues = (text: string | null | undefined) => {
    if (!text) return { valorDaCausa: null, valorDaCompra: null, valorAtualizado: null };

    const parse = (match: RegExpMatchArray | null, truncate = false) => {
        if (match && match[1]) {
            const numericString = match[1].replace(/\./g, '').replace(',', '.');
            const value = parseFloat(numericString);
            return truncate ? Math.trunc(value) : value;
        }
        return null;
    };

    const valorDaCausa = text.match(/Valor da Causa:\s*R\$\s*([\d.,]+)/i);
    const valorDaCompra = text.match(/Valor da Compra:\s*R\$\s*([\d.,]+)/i);
    const valorAtualizado = text.match(/Valor Atualizado:\s*R\$\s*([\d.,]+)/i);

    return {
        valorDaCausa: parse(valorDaCausa),
        valorDaCompra: parse(valorDaCompra, true),
        valorAtualizado: parse(valorAtualizado),
    };
};

/**
 * Extrai apenas o texto descritivo do andamento, ignorando a tag e os campos de valor.
 */
const extractFreeText = (description: string | null | undefined): string => {
    if (!description || !description.includes('#SM')) {
        return description || "Atualização de Valor";
    }
    const lastValueIndex = description.lastIndexOf('R$');
    if (lastValueIndex === -1) return description.substring(description.indexOf('#SM') + 3).trim();
    const textStartIndex = description.indexOf('\n', lastValueIndex);
    if (textStartIndex === -1) return "Atualização de valores do processo";
    return description.substring(textStartIndex).trim();
};

class SyncProcessUpdatesUseCase {
    async execute(): Promise<void> {
        console.log(`[CRON JOB] Iniciando a sincronização de andamentos e documentos...`);

        const activeAssets = await prisma.creditAsset.findMany({
            where: { status: 'Ativo' },
            include: {
                updates: { select: { legalOneUpdateId: true } },
                documents: { select: { legalOneDocumentId: true } }
            }
        });

        if (activeAssets.length === 0) {
            console.log("[CRON JOB] Nenhum ativo ativo encontrado para sincronizar.");
            return;
        }
        console.log(`[CRON JOB] ${activeAssets.length} ativos encontrados para verificação.`);

        for (const asset of activeAssets) {
            try {
                const lawsuitData = await legalOneApiService.getProcessDetails(asset.processNumber);
                if (!lawsuitData) continue;

                const [legalOneUpdates, 
                    // legalOneDocuments
                ] = await Promise.all([
                    legalOneApiService.getProcessUpdates(lawsuitData.id),
                    // legalOneApiService.getProcessDocuments(lawsuitData.id)
                ]);

                const existingUpdateIds = new Set(asset.updates.map(u => u.legalOneUpdateId).filter(id => id !== null));
                const newUpdates = legalOneUpdates.filter(update => !existingUpdateIds.has(update.id));

                const existingDocIds = new Set(asset.documents.map(d => d.legalOneDocumentId).filter(id => id !== null));
                // const newDocuments = legalOneDocuments.filter(doc => !existingDocIds.has(doc.id));

                if (newUpdates.length === 0 
                    // && newDocuments.length === 0
                    ) {
                    console.log(`[CRON JOB] Processo ${asset.processNumber}: Nenhuma novidade encontrada.`);
                    continue;
                }

                const sortedNewUpdates = newUpdates.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                await prisma.$transaction(async (tx) => {
                    let currentAssetValues = {
                        originalValue: asset.originalValue,
                        acquisitionValue: asset.acquisitionValue,
                        currentValue: asset.currentValue,
                    };

                    if (sortedNewUpdates.length > 0) {
                        console.log(`[CRON JOB] Processo ${asset.processNumber}: ${sortedNewUpdates.length} novo(s) andamento(s) encontrado(s)!`);
                        for (const update of sortedNewUpdates) {
                            const allValues = extractAllValues(update.description);
                            const updateText = extractFreeText(update.description);

                            if (allValues.valorDaCausa !== null) currentAssetValues.originalValue = allValues.valorDaCausa;
                            if (allValues.valorDaCompra !== null) currentAssetValues.acquisitionValue = allValues.valorDaCompra;
                            if (allValues.valorAtualizado !== null) currentAssetValues.currentValue = allValues.valorAtualizado;

                            await tx.assetUpdate.create({
                                data: {
                                    assetId: asset.id,
                                    legalOneUpdateId: update.id,
                                    date: new Date(update.date),
                                    description: update.description,
                                    updatedValue: allValues.valorAtualizado ?? currentAssetValues.currentValue,
                                    source: `Legal One - ${update.originType}`
                                }
                            });
                        }
                    }

                    // if (newDocuments.length > 0) {
                    //     console.log(`[CRON JOB] Processo ${asset.processNumber}: ${newDocuments.length} novo(s) documento(s) encontrado(s)!`);
                    //     for (const doc of newDocuments) {
                    //         const downloadUrl = await legalOneApiService.getDocumentDownloadUrl(doc.id);

                    //         await tx.document.create({
                    //             data: {
                    //                 assetId: asset.id,
                    //                 legalOneDocumentId: doc.id,
                    //                 name: doc.archive,
                    //                 category: doc.type,
                    //                 url: downloadUrl,
                    //             }
                    //         });
                    //     }
                    // }

                    await tx.creditAsset.update({
                        where: { id: asset.id },
                        data: {
                            originalValue: currentAssetValues.originalValue,
                            acquisitionValue: currentAssetValues.acquisitionValue,
                            currentValue: currentAssetValues.currentValue,
                        }
                    });
                }, {
                    // Aumenta o timeout desta transação específica para 30 segundos por segurança
                    maxWait: 30000,
                    timeout: 30000,
                });

                console.log(`✅ Ativo ${asset.id} sincronizado!`);

            } catch (error: any) {
                console.error(`[CRON JOB] Erro ao sincronizar o processo ${asset.processNumber}:`, error.message);
                continue;
            }
        }
        console.log(`[CRON JOB] Sincronização concluída.`);
    }
}

export { SyncProcessUpdatesUseCase };

