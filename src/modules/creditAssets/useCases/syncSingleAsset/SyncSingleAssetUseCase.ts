// /src/modules/creditAssets/useCases/syncSingleAsset/SyncSingleAssetUseCase.ts
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

class SyncSingleAssetUseCase {
    async execute(processNumber: string): Promise<void> {
        console.log(`[SYNC MANUAL] Iniciando sincronização para o processo: ${processNumber}`);

        const asset = await prisma.creditAsset.findUnique({
            where: { processNumber },
            include: {
                updates: { select: { legalOneUpdateId: true } },
                documents: { select: { legalOneDocumentId: true } }
            }
        });

        if (!asset) {
            throw new Error("Ativo não encontrado na base de dados local.");
        }

        try {
            const lawsuitData = await legalOneApiService.getProcessDetails(asset.processNumber);

            const [legalOneUpdates, legalOneDocuments] = await Promise.all([
                legalOneApiService.getProcessUpdates(lawsuitData.id),
                legalOneApiService.getProcessDocuments(lawsuitData.id)
            ]);

            const existingUpdateIds = new Set(asset.updates.map(u => u.legalOneUpdateId).filter(id => id !== null));
            const newUpdates = legalOneUpdates.filter(update => !existingUpdateIds.has(update.id));

            const existingDocIds = new Set(asset.documents.map(d => d.legalOneDocumentId).filter(id => id !== null));
            const newDocuments = legalOneDocuments.filter(doc => !existingDocIds.has(doc.id));

            if (newUpdates.length === 0 && newDocuments.length === 0) {
                console.log(`[SYNC MANUAL] Processo ${asset.processNumber}: Nenhuma novidade encontrada.`);
                return;
            }

            // --- OTIMIZAÇÃO: BUSCAR TODAS AS URLs ANTES DA TRANSAÇÃO ---
            console.log(`[SYNC MANUAL] Buscando URLs de download para ${newDocuments.length} novo(s) documento(s)...`);
            const documentPromises = newDocuments.map(doc =>
                legalOneApiService.getDocumentDownloadUrl(doc.id).then(url => ({ ...doc, downloadUrl: url }))
            );
            const documentsWithUrls = await Promise.all(documentPromises);
            console.log(`[SYNC MANUAL] URLs de download obtidas com sucesso.`);
            // -----------------------------------------------------------

            const sortedNewUpdates = newUpdates.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            // Aumentamos o timeout da transação por segurança, embora a otimização deva resolver
            await prisma.$transaction(async (tx) => {
                let currentAssetValues = {
                    originalValue: asset.originalValue,
                    acquisitionValue: asset.acquisitionValue,
                    currentValue: asset.currentValue,
                };

                if (sortedNewUpdates.length > 0) {
                    console.log(`[SYNC MANUAL] Salvando ${sortedNewUpdates.length} novo(s) andamento(s)...`);
                    for (const update of sortedNewUpdates) {
                        // ... (lógica de extrair e atualizar valores - sem alterações)
                    }
                }

                if (documentsWithUrls.length > 0) {
                    console.log(`[SYNC MANUAL] Salvando ${documentsWithUrls.length} novo(s) documento(s)...`);
                    for (const doc of documentsWithUrls) {
                        await tx.document.create({
                            data: {
                                assetId: asset.id,
                                legalOneDocumentId: doc.id,
                                name: doc.archive,
                                category: doc.type || 'Indefinido',
                                url: doc.downloadUrl, // Usa a URL que já buscamos
                            }
                        });
                    }
                }

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

            console.log(`✅ Ativo ${asset.id} (manual) sincronizado com sucesso!`);

        } catch (error: any) {
            console.error(`[SYNC MANUAL] Erro ao sincronizar o processo ${asset.processNumber}:`, error.message);
            throw new Error(`Falha ao sincronizar: ${error.message}`);
        }
    }
}

export { SyncSingleAssetUseCase };

