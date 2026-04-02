import { PrismaClient } from "@prisma/client";
import { legalOneApiService } from "../../../../services/legalOneApiService";
import { EnrichAssetFromLegalOneUseCase } from "../enrichAssetFromLegalOne/EnrichAssetFromLegalOneUseCase";

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
    async execute(legalOneId: number): Promise<void> {
        console.log(`[SYNC MANUAL] Iniciando sincronização para o legalOneId: ${legalOneId}`);

        const asset = await prisma.creditAsset.findUnique({
            where: { legalOneId },
            include: {
                updates: { select: { legalOneUpdateId: true } },
                documents: { select: { legalOneDocumentId: true } },
                investors: true // <--- ADICIONADO: Necessário para a Malha Fina clonar os investidores
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

        console.log(`[SYNC MANUAL] ${legalOneUpdates.length} andamentos e ${legalOneDocuments.length} documentos encontrados no Legal One.`);

        // Filtro de Andamentos
        const existingUpdateIds = new Set(asset.updates.map(u => u.legalOneUpdateId));
        const updatesToProcess = legalOneUpdates.filter(update => {
            if (existingUpdateIds.has(update.id)) return false;
            const desc = update.description || "";
            return desc.toLowerCase().includes(TAG_RELATORIO.toLowerCase()) || desc.toLowerCase().includes(TAG_RELATORIO_SEM_ACENTO.toLowerCase());
        });

        // Filtro de Documentos
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
            
            // =================================================================
            // REFORÇO DE MALHA FINA (Se não houver andamentos novos)
            // =================================================================
            if ((asset.legalOneType === 'Lawsuit' || !asset.legalOneType) && asset.legalOneId) {
                await this.syncChildren(asset).catch(err => 
                    console.error(`[SYNC MANUAL] Erro no reforço de filhos:`, err)
                );
            }
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
                let rawName = doc.archive || `Documento ${doc.id}`;
                const regexTag = new RegExp(TAG_DOCUMENTO, 'i');
                let cleanName = rawName.replace(regexTag, '').replace(/^-/, '').trim();
                if (!cleanName) cleanName = "Documento Sincronizado";
                
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

        // =================================================================
        // REFORÇO DE MALHA FINA (Se houver andamentos novos)
        // =================================================================
        if ((asset.legalOneType === 'Lawsuit' || !asset.legalOneType) && asset.legalOneId) {
            await this.syncChildren(asset).catch(err => 
                console.error(`[SYNC MANUAL] Erro no reforço de filhos:`, err)
            );
        }
    }

    private async syncChildren(parent: any) {
        console.log(`[SYNC MANUAL] 🕵️ Reforço de Malha Fina: Buscando família do processo pai ID: ${parent.legalOneId}`);
        
        const [appeals, issues] = await Promise.all([
            legalOneApiService.getAppealsByLawsuitId(parent.legalOneId!),
            legalOneApiService.getProceduralIssuesByLawsuitId(parent.legalOneId!)
        ]);

        const children = [
            ...appeals.map(a => ({ ...a, type: 'Appeal' })),
            ...issues.map(i => ({ ...i, type: 'ProceduralIssue' }))
        ];

        if (children.length === 0) {
            console.log(`[SYNC MANUAL] ℹ️ Reforço: Nenhum filho encontrado no Legal One.`);
            return;
        }

        for (const child of children) {
            const childNumber = child.identifierNumber || child.oldNumber;
            if (!childNumber) continue;

            const exists = await prisma.creditAsset.findUnique({ where: { legalOneId: child.id } });
            if (exists) continue; 

            console.log(`[SYNC MANUAL] ➡ Reforço Encontrou Filho Perdido: Cadastrando ${childNumber} (${child.type})`);

            const courtPanelDesc = (child as any).courtPanel?.description || "Tribunal não identificado";
            const courtNumber = (child as any).courtPanelNumberText || "";
            const origem = courtNumber ? `${courtNumber} ${courtPanelDesc}` : courtPanelDesc;

            try {
                // Busca as partes reais do filho no Legal One
                const endpointType = child.type === 'Appeal' ? 'appeals' : 'proceduralissues';
                const childParticipants = await legalOneApiService.getEntityParticipants(endpointType, child.id).catch(() => []);
                const customerP = childParticipants.find((p: any) => p.type === "Customer");
                const otherPartyP = childParticipants.find((p: any) => p.type === "OtherParty" && p.isMainParticipant)
                    || childParticipants.find((p: any) => p.type === "OtherParty");
                const childOriginalCreditor = customerP?.contactName || parent.originalCreditor;
                const childOtherParty = otherPartyP?.contactName || parent.otherParty;

                const createdChild = await prisma.$transaction(async (tx) => {
                    const newAsset = await tx.creditAsset.create({
                        data: {
                            processNumber: childNumber,
                            originalCreditor: childOriginalCreditor,
                            otherParty: childOtherParty,
                            nickname: childOtherParty,
                            origemProcesso: origem,
                            legalOneId: child.id,
                            legalOneType: child.type as any,
                            folderId: parent.folderId, 
                            originalValue: 0,
                            acquisitionValue: 0,
                            currentValue: 0,
                            acquisitionDate: parent.acquisitionDate,
                            updateIndexType: parent.updateIndexType,
                            contractualIndexRate: parent.contractualIndexRate,
                            status: 'PENDING_ENRICHMENT',
                            associateId: parent.associateId,
                        }
                    });

                    if (parent.investors && parent.investors.length > 0) {
                        await tx.investment.createMany({
                            data: parent.investors.map((inv: any) => ({
                                investorShare: inv.investorShare || 0,
                                mazzotiniShare: inv.mazzotiniShare || 0,
                                userId: inv.userId,
                                creditAssetId: newAsset.id,
                                associateId: inv.associateId || undefined,
                                acquisitionDate: inv.acquisitionDate || undefined
                            }))
                        });
                    }
                    return newAsset;
                });

                const enrichChild = new EnrichAssetFromLegalOneUseCase();
                await enrichChild.execute(createdChild.id);

            } catch (err: any) {
                console.error(`[SYNC MANUAL] ❌ Falha ao recuperar filho ${childNumber} no reforço:`, err.message);
            }
        }
        
        console.log(`[SYNC MANUAL] ✅ Reforço de Malha Fina concluído.`);
    }
}

export { SyncSingleAssetUseCase };