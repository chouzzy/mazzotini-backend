import { PrismaClient } from "@prisma/client";
import { legalOneApiService } from "../../../../services/legalOneApiService";

const prisma = new PrismaClient();

// ============================================================================
//  CONSTANTES DE FILTRO (TAGS)
// ============================================================================
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


class SyncSingleAssetUseCase {
    async execute(processNumber: string): Promise<void> {
        console.log(`[SYNC MANUAL] Iniciando sincronização para o processo: ${processNumber}`);

        // 1. Busca o ativo local
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

        // 2. Validação
        if (!asset.legalOneId || !asset.legalOneType) {
            console.warn(`[SYNC MANUAL] Ativo ${asset.processNumber} não possui 'legalOneId' ou 'legalOneType'.`);
            throw new Error("Ativo local está dessincronizado. O 'Lookup' (Busca) falhou na criação.");
        }

        try {
            // Lógica "Pai vs. Filho"
            let entityIdToFetchFrom = asset.legalOneId; 
            let entityType = asset.legalOneType;

            console.log(`[SYNC MANUAL] Sincronizando: ${asset.processNumber} (ID: ${asset.legalOneId}, Tipo: ${asset.legalOneType})`);

            if (entityType === 'Appeal') {
                const appealData = await legalOneApiService.getAppealDetails(asset.processNumber);
                if (!appealData.relatedLitigationId) { // Corrigido para relatedLitigationId
                    throw new Error(`Recurso (ID: ${asset.legalOneId}) não possui um ID de Processo (Pai) relacionado.`);
                }
                entityIdToFetchFrom = appealData.relatedLitigationId;

            } else if (entityType === 'ProceduralIssue') {
                const issueData = await legalOneApiService.getProceduralIssueDetails(asset.processNumber);
                if (!issueData.relatedLitigationId) {
                    throw new Error(`Incidente (ID: ${asset.legalOneId}) não possui um ID de Processo (Pai) relacionado.`);
                }
                entityIdToFetchFrom = issueData.relatedLitigationId;
            }

            // 3. Busca os andamentos e documentos (agora do ID "Pai" correto)
            const [legalOneUpdates, legalOneDocuments] = await Promise.all([
                legalOneApiService.getProcessUpdates(entityIdToFetchFrom),
                legalOneApiService.getProcessDocuments(entityIdToFetchFrom) 
            ]);

            console.log(`[SYNC MANUAL] ${legalOneUpdates.length} andamentos e ${legalOneDocuments.length} documentos encontrados no Legal One (ID Pai: ${entityIdToFetchFrom}).`);

            // 4. Lógica de Sincronização de ANDAMENTOS
            const existingUpdateIds = new Set(asset.updates.map(u => u.legalOneUpdateId).filter(id => id !== null));
            
            // Filtra: Apenas novos E que contenham a tag #RelatórioMAA
            const newUpdates = legalOneUpdates.filter(update => 
                !existingUpdateIds.has(update.id) && 
                update.description && 
                update.description.includes(TAG_RELATORIO)
            );

            // 5. Lógica de Sincronização de DOCUMENTOS
            const existingDocIds = new Set(asset.documents.map(d => d.legalOneDocumentId).filter(id => id !== null));
            
            // Filtra: Apenas novos E que contenham a tag #DocumentoMAA no nome (archive)
            const newDocuments = legalOneDocuments.filter(doc => 
                !existingDocIds.has(doc.id) &&
                doc.archive && 
                doc.archive.includes(TAG_DOCUMENTO)
            );

            if (newUpdates.length === 0 && newDocuments.length === 0) {
                console.log(`[SYNC MANUAL] Processo ${asset.processNumber}: Nenhuma novidade encontrada (com as tags corretas).`);
                return;
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
                    console.log(`[SYNC MANUAL] Salvando ${sortedNewUpdates.length} novo(s) andamento(s)...`);
                    for (const update of sortedNewUpdates) {
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
                                source: `Legal One - ${update.originType}`,
                            }
                        });
                    }
                }

                // Salva Documentos
                if (newDocuments.length > 0) {
                    console.log(`[SYNC MANUAL] Salvando metadados de ${newDocuments.length} novo(s) documento(s)...`);
                    for (const doc of newDocuments) {
                        // Opcional: Remover a tag do nome do arquivo ao salvar no banco para ficar mais limpo
                        const cleanName = doc.archive.replace(TAG_DOCUMENTO, '').trim();
                        
                        await tx.document.create({
                            data: {
                                assetId: asset.id,
                                legalOneDocumentId: doc.id,
                                name: cleanName || doc.archive,
                                category: doc.type || 'Documento Legal One',
                                url: '', // A URL será gerada sob demanda pelo frontend
                            }
                        });
                    }
                }

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