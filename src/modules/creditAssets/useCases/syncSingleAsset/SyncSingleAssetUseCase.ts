// src/modules/creditAssets/useCases/syncSingleAsset/SyncSingleAssetUseCase.ts
import { PrismaClient } from "@prisma/client";
import { legalOneApiService } from "../../../../services/legalOneApiService";

const prisma = new PrismaClient();

// As suas funções de parsing (não as alterei)
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

        // 1. Busca o ativo local (sem necessidade de 'select' pois já temos os campos)
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

        // 2. Validação (que faltava)
        if (!asset.legalOneId || !asset.legalOneType) {
            console.warn(`[SYNC MANUAL] Ativo ${asset.processNumber} não possui 'legalOneId' ou 'legalOneType'.`);
            throw new Error("Ativo local está dessincronizado. O 'Lookup' (Busca) falhou na criação.");
        }

        try {
            // =================================================================
            //  INÍCIO DA CORREÇÃO (Lógica "Pai vs. Filho")
            //  (Copiada do EnrichAssetFromLegalOneUseCase)
            // =================================================================

            let entityIdToFetchFrom = asset.legalOneId; // Começa com o ID que temos
            let entityType = asset.legalOneType;

            console.log(`[SYNC MANUAL] Sincronizando: ${asset.processNumber} (ID: ${asset.legalOneId}, Tipo: ${asset.legalOneType})`);

            // Se for 'Appeal' ou 'ProceduralIssue', precisamos buscar
            if (entityType === 'Appeal') {
                console.log(`[SYNC MANUAL] É um Recurso. Buscando o 'relatedLitigationId' (Pai)...`);
                const appealData = await legalOneApiService.getAppealDetails(asset.processNumber);
                if (!appealData.id) {
                    throw new Error(`Recurso (ID: ${asset.legalOneId}) não possui um ID de Processo (Pai) relacionado.`);
                }
                entityIdToFetchFrom = appealData.id;
                console.log(`[SYNC MANUAL] Pai (Lawsuit) encontrado: ${entityIdToFetchFrom}`);

            } else if (entityType === 'ProceduralIssue') {
                console.log(`[SYNC MANUAL] É um Incidente. Buscando o 'relatedLitigationId' (Pai)...`);
                const issueData = await legalOneApiService.getProceduralIssueDetails(asset.processNumber);
                if (!issueData.relatedLitigationId) {
                    throw new Error(`Incidente (ID: ${asset.legalOneId}) não possui um ID de Processo (Pai) relacionado.`);
                }
                entityIdToFetchFrom = issueData.id;
                console.log(`[SYNC MANUAL] Pai (Lawsuit) encontrado: ${entityIdToFetchFrom}`);
            }
            // Se for 'Lawsuit', o entityIdToFetchFrom já está correto.

            // =================================================================
            //  FIM DA CORREÇÃO
            // =================================================================


            // 3. Busca os andamentos e documentos (agora do ID "Pai" correto)
            const [legalOneUpdates,
                //  legalOneDocuments
            ] = await Promise.all([
                legalOneApiService.getProcessUpdates(entityIdToFetchFrom),
                // legalOneApiService.getProcessDocuments(entityIdToFetchFrom) // Assumindo que os docs também ficam no Pai
            ]);

            console.log(`[SYNC MANUAL] ${legalOneUpdates.length} andamentos e documentos encontrados no Legal One (ID Pai: ${entityIdToFetchFrom}).`);

            // 4. Lógica de Sincronização (O seu código, que já estava correto)
            const existingUpdateIds = new Set(asset.updates.map(u => u.legalOneUpdateId).filter(id => id !== null));
            const newUpdates = legalOneUpdates.filter(update => !existingUpdateIds.has(update.id));

            // const existingDocIds = new Set(asset.documents.map(d => d.legalOneDocumentId).filter(id => id !== null));
            // const newDocuments = legalOneDocuments.filter(doc => !existingDocIds.has(doc.id));

            if (newUpdates.length === 0
                // && newDocuments.length === 0
            ) {
                console.log(`[SYNC MANUAL] Processo ${asset.processNumber}: Nenhuma novidade encontrada.`);
                return;
            }

            const sortedNewUpdates = newUpdates.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            await prisma.$transaction(async (tx) => {
                let currentAssetValues = {
                    originalValue: asset.originalValue,
                    acquisitionValue: asset.acquisitionValue,
                    currentValue: asset.currentValue,
                };

                if (sortedNewUpdates.length > 0) {
                    console.log(`[SYNC MANUAL] Salvando ${sortedNewUpdates.length} novo(s) andamento(s)...`);
                    for (const update of sortedNewUpdates) {
                        // NOTA: Esta lógica de parsing é DIFERENTE da que usamos no EnrichUseCase (#SM).
                        // Se o seu botão "Sincronizar" também deve obedecer o "#SM",
                        // precisaremos refatorar esta parte.
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
                                description: update.description, // <-- Salva a descrição (que pode ou não ser a limpa)
                                updatedValue: allValues.valorAtualizado ?? currentAssetValues.currentValue,
                                source: `Legal One - ${update.originType}`,
                            }
                        });
                    }
                }

                // if (newDocuments.length > 0) {
                //     console.log(`[SYNC MANUAL] Salvando metadados de ${newDocuments.length} novo(s) documento(s)...`);
                //     for (const doc of newDocuments) {
                //         await tx.document.create({
                //             data: {
                //                 assetId: asset.id,
                //                 legalOneDocumentId: doc.id,
                //                 name: doc.archive,
                //                 category: doc.type || 'Indefinido',
                //                 url: '',
                //             }
                //         });
                //     }
                // }

                // Atualiza os valores principais
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

            console.log(`✅ Ativo ${asset.id} (manual) sincronizado com sucesso!`);

        } catch (error: any) {
            console.error(`[SYNC MANUAL] Erro ao sincronizar o processo ${asset.processNumber}:`, error.message);
            throw new Error(`Falha ao sincronizar: ${error.message}`);
        }
    }
}

export { SyncSingleAssetUseCase };