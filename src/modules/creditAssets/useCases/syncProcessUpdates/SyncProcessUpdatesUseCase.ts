import { PrismaClient } from "@prisma/client";
import { legalOneApiService } from "../../../../services/legalOneApiService";

const prisma = new PrismaClient();

// Tags
const TAG_RELATORIO = "#RelatórioMAA";
const TAG_DOCUMENTO = "#DocumentoMAA";

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
                // Para simplificar, este useCase assume Lawsuit direto ou que o asset.processNumber busca corretamente.
                // Se precisar da lógica de Pai vs Filho aqui também, idealmente deveria ser refatorado para usar o legalOneId salvo.
                const lawsuitData = await legalOneApiService.getProcessDetails(asset.processNumber);
                if (!lawsuitData) continue;

                // Busca Andamentos e Documentos em paralelo
                const [legalOneUpdates, legalOneDocuments] = await Promise.all([
                    legalOneApiService.getProcessUpdates(lawsuitData.id),
                    legalOneApiService.getProcessDocuments(lawsuitData.id)
                ]);

                // --- 1. Sincronização de ANDAMENTOS ---
                const existingUpdateIds = new Set(asset.updates.map(u => u.legalOneUpdateId).filter(id => id !== null));
                const newUpdates = legalOneUpdates.filter(update => !existingUpdateIds.has(update.id));

                // --- 2. Sincronização de DOCUMENTOS (Filtrando por #DocumentoMAA) ---
                const existingDocIds = new Set(asset.documents.map(d => d.legalOneDocumentId).filter(id => id !== null));
                
                // Filtra apenas documentos que contenham a TAG no nome (archive) e que sejam novos
                const newDocuments = legalOneDocuments.filter(doc => 
                    !existingDocIds.has(doc.id) && 
                    doc.archive.includes(TAG_DOCUMENTO)
                );

                if (newUpdates.length === 0 && newDocuments.length === 0) {
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

                    // Salva Andamentos
                    if (sortedNewUpdates.length > 0) {
                        console.log(`[CRON JOB] Processo ${asset.processNumber}: ${sortedNewUpdates.length} novo(s) andamento(s)!`);
                        for (const update of sortedNewUpdates) {
                            // Se for um relatório oficial, usa a lógica de extração
                            const isReport = update.description.includes(TAG_RELATORIO);
                            
                            const allValues = extractAllValues(update.description);
                            
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

                    // Salva Documentos
                    if (newDocuments.length > 0) {
                        console.log(`[CRON JOB] Processo ${asset.processNumber}: ${newDocuments.length} novo(s) documento(s) com a tag ${TAG_DOCUMENTO}!`);
                        for (const doc of newDocuments) {
                            // Limpa o nome do arquivo removendo a tag, se desejar
                            const cleanName = doc.archive.replace(TAG_DOCUMENTO, '').trim();

                            // O link de download é gerado sob demanda, mas se quiser salvar uma url temporária:
                            // const downloadUrl = await legalOneApiService.getDocumentDownloadUrl(doc.id);
                            
                            await tx.document.create({
                                data: {
                                    assetId: asset.id,
                                    legalOneDocumentId: doc.id,
                                    name: cleanName || doc.archive,
                                    category: doc.type || 'Documento Legal One',
                                    url: '', // URL vazia indica que deve ser buscada no Legal One na hora do download
                                }
                            });
                        }
                    }

                    // Atualiza valores do ativo
                    await tx.creditAsset.update({
                        where: { id: asset.id },
                        data: {
                            originalValue: currentAssetValues.originalValue,
                            acquisitionValue: currentAssetValues.acquisitionValue,
                            currentValue: currentAssetValues.currentValue,
                        }
                    });
                }, {
                    maxWait: 30000,
                    timeout: 30000,
                });

                console.log(`✅ Ativo ${asset.id} sincronizado com sucesso!`);

            } catch (error: any) {
                console.error(`[CRON JOB] Erro ao sincronizar o processo ${asset.processNumber}:`, error.message);
                continue;
            }
        }
        console.log(`[CRON JOB] Sincronização concluída.`);
    }
}

export { SyncProcessUpdatesUseCase };