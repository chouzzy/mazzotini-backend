import { PrismaClient } from "@prisma/client";
import { legalOneApiService } from "../../../../services/legalOneApiService";

const prisma = new PrismaClient();

const TAG_RELATORIO = "#RelatórioMAA";
const TAG_RELATORIO_SEM_ACENTO = "#RelatorioMAA";
const TAG_DOCUMENTO = "#DocumentoMAA";

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
    return { valorDaCausa: parse(valorDaCausa), valorDaCompra: parse(valorDaCompra, true), valorAtualizado: parse(valorAtualizado) };
};

const extractFreeText = (description: string | null | undefined): string => {
    if (!description) return "Atualização de Valor";
    const descLower = description.toLowerCase();
    let tagToUse = "";
    
    if (descLower.includes(TAG_RELATORIO.toLowerCase())) {
        tagToUse = TAG_RELATORIO;
    } else if (descLower.includes(TAG_RELATORIO_SEM_ACENTO.toLowerCase())) {
        tagToUse = TAG_RELATORIO_SEM_ACENTO;
    } else {
         return description;
    }
    
    const regex = new RegExp(tagToUse, 'i');
    const match = description.match(regex);
    
    if (match && match.index !== undefined) {
         let contentAfterTag = description.substring(match.index + match[0].length).trim();
         const lastValueIndex = contentAfterTag.lastIndexOf('R$');
         if (lastValueIndex !== -1) {
             const textStartIndex = contentAfterTag.indexOf('\n', lastValueIndex);
             if (textStartIndex !== -1) {
                 return contentAfterTag.substring(textStartIndex).trim();
             }
         }
         return contentAfterTag;
    }
    return description;
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

        if (!asset) throw new Error("Ativo não encontrado.");
        
        let entityIdToFetchFrom = asset.legalOneId;
        
        if (!entityIdToFetchFrom) {
             const details = await legalOneApiService.getProcessDetails(asset.processNumber);
             entityIdToFetchFrom = details.id;
             await prisma.creditAsset.update({ where: { id: asset.id }, data: { legalOneId: details.id, legalOneType: 'Lawsuit' } });
        }

        console.log(`[SYNC MANUAL] Sincronizando: ${asset.processNumber} (ID: ${entityIdToFetchFrom}, Tipo: ${asset.legalOneType || 'Lawsuit'})`);

        const [legalOneUpdates, legalOneDocuments] = await Promise.all([
            legalOneApiService.getProcessUpdates(entityIdToFetchFrom),
            legalOneApiService.getProcessDocuments(entityIdToFetchFrom)
        ]);

        console.log(`[SYNC MANUAL] ${legalOneUpdates.length} andamentos e ${legalOneDocuments.length} documentos encontrados no Legal One (ID Pai: ${entityIdToFetchFrom}).`);

        // =================================================================
        // BLOCO DE DEBUG (Espião): Removido o 'title', adicionado o 'notes'
        // =================================================================
        if (legalOneDocuments.length > 0) {
            console.log(`\n[DEBUG DOCUMENTOS] --- Analisando o conteúdo recebido ---`);
            legalOneDocuments.forEach((doc, index) => {
                console.log(`Doc ${index + 1}:`);
                console.log(` - ID: ${doc.id}`);
                console.log(` - Archive (Nome do ficheiro): "${doc.archive}"`);
                console.log(` - Description (Descrição): "${doc.description}"`);
                // Fazemos cast temporário para any caso o notes ainda não esteja na interface
                console.log(` - Notes (Notas): "${(doc as any).notes}"`);
                console.log(`--------------------------------------------------`);
            });
        }
        // =================================================================

        // Filtro de Andamentos
        const existingUpdateIds = new Set(asset.updates.map(u => u.legalOneUpdateId));
        const updatesToProcess = legalOneUpdates.filter(update => {
            if (existingUpdateIds.has(update.id)) return false;
            const desc = update.description || "";
            return desc.toLowerCase().includes(TAG_RELATORIO.toLowerCase()) || desc.toLowerCase().includes(TAG_RELATORIO_SEM_ACENTO.toLowerCase());
        });

        // Filtro de Documentos (Detetive)
        const existingDocIds = new Set(asset.documents.map(d => d.legalOneDocumentId));
        const documentsToProcess = legalOneDocuments.filter(doc => {
            if (existingDocIds.has(doc.id)) return false;
            
            const archive = doc.archive?.toLowerCase() || "";
            const description = doc.description?.toLowerCase() || "";
            const notes = (doc as any).notes?.toLowerCase() || "";
            const tagLower = TAG_DOCUMENTO.toLowerCase();

            return archive.includes(tagLower) || description.includes(tagLower) || notes.includes(tagLower);
        });

        if (updatesToProcess.length === 0 && documentsToProcess.length === 0) {
            console.log(`[SYNC MANUAL] Processo ${asset.processNumber}: Nenhuma novidade encontrada (com as tags corretas).`);
            return;
        }

        const sortedNewUpdates = updatesToProcess.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        await prisma.$transaction(async (tx) => {
            let currentAssetValues = {
                originalValue: asset.originalValue,
                acquisitionValue: asset.acquisitionValue,
                currentValue: asset.currentValue,
            };

            // Salva Andamentos
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
                        description: updateText,
                        updatedValue: allValues.valorAtualizado ?? currentAssetValues.currentValue,
                        source: `Legal One - ${update.originType || 'Manual'}`
                    }
                });
            }

            // Salva Documentos
            for (const doc of documentsToProcess) {
                // O nome do arquivo na API do Legal One sempre reside no 'archive'
                let rawName = doc.archive || `Documento ${doc.id}`;
                
                // Removemos a tag caso ela venha no nome do arquivo
                const regexTag = new RegExp(TAG_DOCUMENTO, 'i');
                let cleanName = rawName.replace(regexTag, '').replace(/^-/, '').trim();
                
                // Fallback para garantir que nunca fique com o nome vazio
                if (!cleanName) {
                    cleanName = "Documento Sincronizado";
                }
                
                await tx.document.create({
                    data: {
                        assetId: asset.id,
                        legalOneDocumentId: doc.id,
                        name: cleanName,
                        category: doc.type || 'Documento Legal One',
                        url: '', 
                    }
                });
            }

            // Atualiza valores do Ativo
            await tx.creditAsset.update({
                where: { id: asset.id },
                data: {
                    originalValue: currentAssetValues.originalValue,
                    acquisitionValue: currentAssetValues.acquisitionValue,
                    currentValue: currentAssetValues.currentValue,
                }
            });
        }, { maxWait: 30000, timeout: 30000 });

        console.log(`[SYNC MANUAL] ✅ Sucesso! ${updatesToProcess.length} andamentos e ${documentsToProcess.length} documentos salvos.`);
    }
}

export { SyncSingleAssetUseCase };