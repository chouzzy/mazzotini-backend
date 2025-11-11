// src/modules/creditAssets/useCases/enrichAssetFromLegalOne/EnrichAssetFromLegalOneUseCase.ts
import { PrismaClient } from "@prisma/client";
import { 
    legalOneApiService, 
    LegalOneUpdate 
} from "../../../../services/legalOneApiService"; 

const prisma = new PrismaClient();

// ============================================================================
//  FUNÇÃO "TRADUTORA" (MAPEADORA DE DADOS)
// ============================================================================

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

    // 2. Limpa o Texto (Remove as linhas que não queremos)
    const allLines = description.split('\n');
    const cleanedLines = allLines.filter(line => 
        !line.trim().toLowerCase().startsWith('valor da causa:') && 
        !line.trim().toLowerCase().startsWith('valor da compra:')
    );

    // Remove linhas em branco extras do topo
    while (cleanedLines.length > 0 && cleanedLines[0].trim() === '') {
        cleanedLines.shift();
    }
    
    const cleanedText = cleanedLines.join('\n');

    return { value: extractedValue, cleanedText: cleanedText };
};

// ============================================================================
//  O USE CASE REATORADO (LÓGICA DO "PAI VS. FILHO")
// ============================================================================
class EnrichAssetFromLegalOneUseCase {
    async execute(creditAssetId: string): Promise<void> {
        
        // 1. Busca o ativo no nosso banco
        const asset = await prisma.creditAsset.findUnique({
            where: { id: creditAssetId },
        });

        // VALIDAÇÃO 1: O ativo existe?
        if (!asset) {
            console.warn(`[Enrich] Ativo ${creditAssetId} não encontrado. O cron de enriquecimento foi ignorado.`);
            return; 
        }

        // VALIDAÇÃO 2: O ativo já foi buscado (tem ID)?
        if (!asset.legalOneId || !asset.legalOneType) {
            console.warn(`[Enrich] Ativo ${creditAssetId} (${asset.processNumber}) não possui 'legalOneId' ou 'legalOneType'. O 'Lookup' (Busca) precisa ser executado primeiro.`);
            // Se ele foi criado e AINDA não tem ID, marca como falha.
            if(asset.status === 'PENDING_ENRICHMENT') {
                await prisma.creditAsset.update({ where: { id: creditAssetId }, data: { status: 'FAILED_ENRICHMENT' }});
            }
            return;
        }

        // VALIDAÇÃO 3: O ativo está falhado?
        if (asset.status === 'FAILED_ENRICHMENT') {
             console.warn(`[Enrich] Ativo ${creditAssetId} está marcado como 'FAILED'. Pulando.`);
             return;
        }

        try {
            // =================================================================
            //  INÍCIO DA LÓGICA (PAI VS FILHO)
            // =================================================================
            
            let entityIdToFetchUpdates = asset.legalOneId; 
            let entityType = asset.legalOneType;

            console.log(`[Enrich] Iniciando enriquecimento/sincronização para: ${asset.processNumber} (ID: ${asset.legalOneId}, Tipo: ${asset.legalOneType})`);

            // Se for um Recurso ou Incidente, buscamos o ID do "Pai"
            if (entityType === 'Appeal') {
                console.log(`[Enrich] É um Recurso. Buscando o 'relatedLitigationId' (Pai)...`);
                const appealData = await legalOneApiService.getAppealDetails(asset.processNumber);
                if (!appealData.relatedLitigationId) {
                    throw new Error(`Recurso (ID: ${asset.legalOneId}) não possui um ID de Processo (Pai) relacionado.`);
                }
                entityIdToFetchUpdates = appealData.relatedLitigationId; 
                console.log(`[Enrich] Pai (Lawsuit) encontrado: ${entityIdToFetchUpdates}`);

            } else if (entityType === 'ProceduralIssue') {
                console.log(`[Enrich] É um Incidente. Buscando o 'relatedLitigationId' (Pai)...`);
                const issueData = await legalOneApiService.getProceduralIssueDetails(asset.processNumber);
                if (!issueData.relatedLitigationId) {
                    throw new Error(`Incidente (ID: ${asset.legalOneId}) não possui um ID de Processo (Pai) relacionado.`);
                }
                entityIdToFetchUpdates = issueData.relatedLitigationId; 
                console.log(`[Enrich] Pai (Lawsuit) encontrado: ${entityIdToFetchUpdates}`);
            }
            
            // =================================================================
            //  FIM DA LÓGICA
            // =================================================================

            // Passo 2: Busca os andamentos (Updates) DO PAI
            // (Usando o filtro de 'linkType' e 'linkId' que você descobriu)
            const updatesData = await legalOneApiService.getProcessUpdates(entityIdToFetchUpdates);
            
            // Filtro por #SM (na 'description' do andamento)
            const manualUpdates = updatesData.filter(upd => 
                upd.description && upd.description.includes('#SM')
            );

            if (manualUpdates.length === 0) {
                 console.log(`[Enrich] Ativo ${creditAssetId} não possui novos andamentos #SM.`);
                 // Se o ativo estava pendente, marca como Ativo.
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
                
                // Passo 3: Cria um registo de AssetUpdate para cada andamento manual NOVO
                for (const update of manualUpdates) {
                    
                    // Verifica se este andamento (pelo ID do Legal One) já foi importado
                    const existingUpdate = await tx.assetUpdate.findFirst({
                        where: { 
                            assetId: creditAssetId,
                            legalOneUpdateId: update.id 
                        }
                    });
                    
                    // Se já importamos este update antes, pulamos para o próximo
                    if (existingUpdate) {
                        continue; 
                    }

                    // Se chegamos aqui, é um andamento novo
                    newUpdatesFound++;
                    
                    // =================================================================
                    //  CORREÇÃO (Usando a nova função e o campo 'description')
                    // =================================================================
                    const { value: extractedValue, cleanedText: cleanedDescription } = parseAndCleanDescription(update.description);
                    
                    if (extractedValue !== null) {
                        latestCurrentValue = extractedValue; // O "Plano B"
                    }

                    await tx.assetUpdate.create({
                        data: {
                            assetId: creditAssetId,
                            legalOneUpdateId: update.id, 
                            date: new Date(update.date),
                            description: cleanedDescription, // Salva o texto limpo
                            updatedValue: extractedValue || latestCurrentValue, // Se não tiver valor, repete o último
                            source: 'Legal One - Manual (#SM)',
                        }
                    });
                    // =================================================================
                }

                // Passo 4: Atualiza o ativo principal (SÓ SE HOUVE MUDANÇA)
                if (newUpdatesFound > 0) {
                    await tx.creditAsset.update({
                        where: { id: creditAssetId },
                        data: {
                            currentValue: latestCurrentValue, // Atualiza o valor principal do ativo
                            status: 'Ativo', 
                        },
                    });
                } else if (asset.status === 'PENDING_ENRICHMENT') {
                    // Se estava pendente e não achou NENHUM andamento #SM (novo ou velho)
                    // apenas marca como ativo, mas não mexe no valor.
                    await tx.creditAsset.update({
                        where: { id: creditAssetId },
                        data: { status: 'Ativo' },
                    });
                }
            });

            if (newUpdatesFound > 0) {
                 console.log(`✅ Ativo ${creditAssetId} enriquecido e ${newUpdatesFound} novos andamentos #SM sincronizados! Valor atualizado para R$ ${latestCurrentValue}`);
            } else {
                 console.log(`[Enrich] Ativo ${creditAssetId} não possui novos andamentos #SM. Nenhuma atualização feita.`);
            }

        } catch (error: any) {
            console.error(`❌ Erro ao enriquecer o ativo ${creditAssetId}:`, error.response?.data || error.message);
            await prisma.creditAsset.update({
                where: { id: creditAssetId },
                data: { status: 'FAILED_ENRICHMENT' }, 
            });
        }
    }
}

export { EnrichAssetFromLegalOneUseCase };