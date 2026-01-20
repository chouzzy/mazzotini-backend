import { PrismaClient } from "@prisma/client";
import { 
    legalOneApiService, 
} from "../../../../services/legalOneApiService"; 

const prisma = new PrismaClient();

// ============================================================================
//  CONSTANTES DE IDENTIFICAÇÃO
// ============================================================================
const TAG_ANDAMENTO = "#RelatórioMAA"; // Substitui o antigo #SM

interface ParsedUpdateData {
    value: number | null;
    cleanedText: string;
}

/**
 * Tenta extrair o "Valor Atualizado" E limpar o texto da descrição.
 */
const parseAndCleanDescription = (description: string | null): ParsedUpdateData => {
    if (!description) {
        return { value: null, cleanedText: 'Andamento sem descrição' };
    }

    // 1. Extrai o Valor (do "Valor Atualizado")
    let extractedValue: number | null = null;
    const valueMatch = description.match(/Valor Atualizado:\s*R\$\s*([\d.,]+)/i);
    if (valueMatch && valueMatch[1]) {
        // Converte o formato brasileiro (1.234,56) para um número (1234.56)
        const numericString = valueMatch[1].replace(/\./g, '').replace(',', '.');
        extractedValue = parseFloat(numericString);
    }

    // 2. Limpa o Texto
    const allLines = description.split('\n');

    return { value: extractedValue, cleanedText: description };
};

// ============================================================================
//  O USE CASE (ATUALIZADO PARA #RelatórioMAA)
// ============================================================================
class EnrichAssetFromLegalOneUseCase {
    async execute(creditAssetId: string): Promise<void> {
        
        // 1. Busca o ativo no nosso banco
        const asset = await prisma.creditAsset.findUnique({
            where: { id: creditAssetId },
        });

        if (!asset) {
            console.warn(`[Enrich] Ativo ${creditAssetId} não encontrado. O cron de enriquecimento foi ignorado.`);
            return; 
        }

        if (!asset.legalOneId || !asset.legalOneType) {
            console.warn(`[Enrich] Ativo ${creditAssetId} (${asset.processNumber}) não possui 'legalOneId' ou 'legalOneType'.`);
            if(asset.status === 'PENDING_ENRICHMENT') {
                await prisma.creditAsset.update({ where: { id: creditAssetId }, data: { status: 'FAILED_ENRICHMENT' }});
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

            // Se for um Recurso ou Incidente, buscamos o ID do "Pai"
            if (entityType === 'Appeal') {
                const appealData = await legalOneApiService.getAppealDetails(asset.processNumber);
                if (appealData.relatedLitigationId) {
                    entityIdToFetchUpdates = appealData.relatedLitigationId; 
                }
            } else if (entityType === 'ProceduralIssue') {
                const issueData = await legalOneApiService.getProceduralIssueDetails(asset.processNumber);
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

        } catch (error: any) {
            console.error(`❌ Erro ao enriquecer o ativo ${creditAssetId}:`, error.message);
            await prisma.creditAsset.update({
                where: { id: creditAssetId },
                data: { status: 'FAILED_ENRICHMENT' }, 
            });
        }
    }
}

export { EnrichAssetFromLegalOneUseCase };