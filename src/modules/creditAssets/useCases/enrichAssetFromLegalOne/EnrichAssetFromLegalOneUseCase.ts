
import { prisma } from '../../../../prisma';
import { legalOneApiService } from "../../../../services/legalOneApiService";


const TAG_ANDAMENTO = "#RelatórioMAA";

// Assumindo que esta função já existe no topo do seu ficheiro original
declare function parseAndCleanDescription(description: string): { value: number | null, cleanedText: string };

class EnrichAssetFromLegalOneUseCase {
    
    async execute(creditAssetId: string): Promise<void> {
        // 1. Busca o ativo no nosso banco
        // IMPORTANTE: Adicionado 'include: { investors: true }' para que o syncChildren tenha os dados
        const asset = await prisma.creditAsset.findUnique({
            where: { id: creditAssetId },
            include: { investors: true } 
        });

        if (!asset) {
            console.warn(`[Enrich] Ativo ${creditAssetId} não encontrado. O cron de enriquecimento foi ignorado.`);
            return;
        }

        if (!asset.legalOneId || !asset.legalOneType) {
            console.warn(`[Enrich] Ativo ${creditAssetId} (${asset.processNumber}) não possui 'legalOneId' ou 'legalOneType'.`);
            if (asset.status === 'PENDING_ENRICHMENT') {
                await prisma.creditAsset.update({ where: { id: creditAssetId }, data: { status: 'FAILED_ENRICHMENT' } });
            }
            return;
        }

        if (asset.status === 'FAILED_ENRICHMENT') {
            console.warn(`[Enrich] Ativo ${creditAssetId} está marcado como 'FAILED'. Pulando.`);
            return;
        }

        try {
            let entityIdToFetchUpdates = asset.legalOneId;
            let entityType = asset.legalOneType;

            console.log(`[Enrich] Iniciando enriquecimento para: ${asset.processNumber} (ID: ${asset.legalOneId})`);

            // Se for um Recurso ou Incidente, buscamos o ID do Pai via legalOneId (não processNumber)
            if (entityType === 'Appeal') {
                const appealData = await legalOneApiService.getAppealById(asset.legalOneId);
                if (appealData.relatedLitigationId) {
                    entityIdToFetchUpdates = appealData.relatedLitigationId;
                }
            } else if (entityType === 'ProceduralIssue') {
                const issueData = await legalOneApiService.getProceduralIssueById(asset.legalOneId);
                if (issueData.relatedLitigationId) {
                    entityIdToFetchUpdates = issueData.relatedLitigationId;
                }
            }

            // Passo 2: Busca os andamentos (Updates) DO PAI
            const updatesData = await legalOneApiService.getProcessUpdates(entityIdToFetchUpdates);

            // =================================================================
            //  ALTERAÇÃO: FILTRO PELA NOVA TAG #RelatórioMAA
            // =================================================================
            const manualUpdates = updatesData.filter(upd =>
                upd.description && upd.description.includes(TAG_ANDAMENTO)
            );

            if (manualUpdates.length === 0) {
                console.log(`[Enrich] Ativo ${creditAssetId} não possui novos andamentos ${TAG_ANDAMENTO}.`);
                if (asset.status === 'PENDING_ENRICHMENT') {
                    await prisma.creditAsset.update({
                        where: { id: creditAssetId },
                        data: { status: 'Ativo' },
                    });
                }
                
                // =================================================================
                // NOVO: REFORÇO AQUI TAMBÉM (Caso não haja andamentos, mas tenha filhos)
                // =================================================================
                if (asset.legalOneType === 'Lawsuit' && asset.legalOneId) {
                    await this.syncChildren(asset).catch(err => 
                        console.error(`[Enrich] Erro no reforço de filhos:`, err)
                    );
                }
                
                return;
            }

            let latestCurrentValue = asset.currentValue;
            let newUpdatesFound = 0;

            await prisma.$transaction(async (tx) => {

                for (const update of manualUpdates) {

                    const existingUpdate = await tx.assetUpdate.findFirst({
                        where: {
                            assetId: creditAssetId,
                            legalOneUpdateId: update.id
                        }
                    });

                    if (existingUpdate) continue;

                    newUpdatesFound++;

                    // Limpa a descrição e extrai valor
                    const { value: extractedValue, cleanedText: cleanedDescription } = parseAndCleanDescription(update.description);

                    if (extractedValue !== null) {
                        latestCurrentValue = extractedValue; // O "Plano B"
                    }

                    await tx.assetUpdate.create({
                        data: {
                            assetId: creditAssetId,
                            legalOneUpdateId: update.id,
                            date: new Date(update.date),
                            description: cleanedDescription, // Salva o texto limpo (sem a tag)
                            updatedValue: extractedValue || latestCurrentValue,
                            // =================================================================
                            //  ALTERAÇÃO: FONTE ATUALIZADA
                            // =================================================================
                            source: `Legal One - Manual - #RelatórioMAA`,
                        }
                    });
                }

                if (newUpdatesFound > 0) {
                    await tx.creditAsset.update({
                        where: { id: creditAssetId },
                        data: {
                            currentValue: latestCurrentValue,
                            status: 'Ativo',
                        },
                    });
                } else if (asset.status === 'PENDING_ENRICHMENT') {
                    await tx.creditAsset.update({
                        where: { id: creditAssetId },
                        data: { status: 'Ativo' },
                    });
                }
            });

            if (newUpdatesFound > 0) {
                console.log(`✅ Ativo ${creditAssetId} enriquecido e ${newUpdatesFound} novos andamentos ${TAG_ANDAMENTO} sincronizados!`);
            }

            // =================================================================
            // NOVO: REFORÇO DE SINCRONIZAÇÃO DE FILHOS (MALHA FINA) FINAL DO TRY
            // =================================================================
            if (asset.legalOneType === 'Lawsuit' && asset.legalOneId) {
                await this.syncChildren(asset).catch(err => 
                    console.error(`[Enrich] Erro no reforço de filhos:`, err)
                );
            }

        } catch (error: any) {
            console.error(`❌ Erro ao enriquecer o ativo ${creditAssetId}:`, error.message);
            await prisma.creditAsset.update({
                where: { id: creditAssetId },
                data: { status: 'FAILED_ENRICHMENT' },
            });
        }
    }

    private async syncChildren(parent: any) {
        console.log(`[Enrich] 🕵️ Reforço de Malha Fina: Buscando família do processo pai ID: ${parent.legalOneId}`);
        
        // Assegure-se de que o legalOneApiService está importado no topo do ficheiro
        const [appeals, issues] = await Promise.all([
            legalOneApiService.getAppealsByLawsuitId(parent.legalOneId!),
            legalOneApiService.getProceduralIssuesByLawsuitId(parent.legalOneId!)
        ]);

        const children = [
            ...appeals.map(a => ({ ...a, type: 'Appeal' })),
            ...issues.map(i => ({ ...i, type: 'ProceduralIssue' }))
        ];

        if (children.length === 0) {
            console.log(`[Enrich] ℹ️ Reforço: Nenhum filho encontrado no Legal One.`);
            return;
        }

        for (const child of children) {
            const childNumber = child.identifierNumber || child.otherNumber;
            if (!childNumber) continue;

            // Tenta encontrar se o filho já está no nosso banco de dados
            const exists = await prisma.creditAsset.findUnique({ where: { legalOneId: child.id } });
            if (exists) {
                // Se já existe, não faz nada (ele será enriquecido na vez dele)
                continue;
            }

            console.log(`[Enrich] ➡ Reforço Encontrou Filho Perdido: Cadastrando ${childNumber} (${child.type})`);

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

                    // Clona os investidores exatos do pai para o filho resgatado
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

                // Auto-Enriquecimento: Dispara a própria classe para ir buscar os andamentos deste novo filho
                const enrichChild = new EnrichAssetFromLegalOneUseCase();
                await enrichChild.execute(createdChild.id);

            } catch (err: any) {
                console.error(`[Enrich] ❌ Falha ao recuperar filho ${childNumber} no reforço:`, err.message);
            }
        }
        
        console.log(`[Enrich] ✅ Reforço de Malha Fina concluído.`);
    }
}

export { EnrichAssetFromLegalOneUseCase };