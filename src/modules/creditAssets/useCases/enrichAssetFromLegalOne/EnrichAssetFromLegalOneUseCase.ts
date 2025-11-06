import { PrismaClient } from "@prisma/client";
import { legalOneApiService, LegalOneLawsuit, LegalOneUpdate } from "../../../../services/legalOneApiService"; 

const prisma = new PrismaClient();

// ============================================================================
//  FUNÇÕES "TRADUTORAS" (MAPEADORAS DE DADOS)
// ============================================================================

/**
 * Tenta extrair um valor monetário de uma string de anotações.
 * Hipótese: o formato será "Valor: R$ 12.345,67".
 */
const parseValueFromNotes = (notes: string | null): number | null => {
    if (!notes) return null;
    
    const valueMatch = notes.match(/Valor:\s*R\$\s*([\d.,]+)/i);
    if (valueMatch && valueMatch[1]) {
        // Converte o formato brasileiro (1.234,56) para um número
        const numericString = valueMatch[1].replace(/\./g, '').replace(',', '.');
        return parseFloat(numericString);
    }
    return null;
};

/**
 * Mapeia os dados principais do processo.
 */
const mapLawsuitData = async (lawsuit: LegalOneLawsuit) => {
    let originalCreditorName = 'Não identificado';
    const creditorParticipant = lawsuit.participants?.find(p => p.type === 'OtherParty');
    
    if (creditorParticipant?.contactId) {
        try {
            const contactDetails = await legalOneApiService.getContactDetails(creditorParticipant.contactId);
            originalCreditorName = contactDetails.name;
        } catch (error) {
            console.error(`[MAP] Erro ao buscar nome do credor para o contactId: ${creditorParticipant.contactId}`, error);
        }
    }

    return {
        originalCreditor: originalCreditorName,
        originalValue: lawsuit.monetaryAmount?.value || 0,
        // Adicionaremos mais mapeamentos aqui conforme necessário
    };
};


// ============================================================================
//  O USE CASE REATORADO (COM LÓGICA DE SINCRONIZAÇÃO DE ANDAMENTOS)
// ============================================================================
class EnrichAssetFromLegalOneUseCase {
    async execute(creditAssetId: string): Promise<void> {
        const asset = await prisma.creditAsset.findUnique({
            where: { id: creditAssetId },
        });

        if (!asset || asset.status !== 'PENDING_ENRICHMENT') {
            return;
        }

        try {
            // Passo 1: Busca os dados principais e os andamentos em paralelo
            const lawsuitData = await legalOneApiService.getProcessDetails(asset.processNumber);
            const updatesData = await legalOneApiService.getProcessUpdates(lawsuitData.id);
            
            // Passo 2: Mapeia os dados principais do processo
            const mappedLawsuitData = await mapLawsuitData(lawsuitData);

            // Filtra apenas os andamentos manuais que nos interessam
            const manualUpdates = updatesData.filter(upd => upd.originType === 'Manual');

            let latestCurrentValue = asset.currentValue;

            // Inicia uma transação para garantir que tudo seja salvo de uma vez
            await prisma.$transaction(async (tx) => {
                // Passo 3: Cria um registo de AssetUpdate para cada andamento manual
                for (const update of manualUpdates) {
                    const extractedValue = parseValueFromNotes(update.notes);
                    
                    // Se este andamento tiver um valor, ele se torna o novo valor atual
                    if (extractedValue !== null) {
                        latestCurrentValue = extractedValue;
                    }

                    await tx.assetUpdate.create({
                        data: {
                            assetId: creditAssetId,
                            date: new Date(update.date),
                            description: update.description,
                            updatedValue: extractedValue || latestCurrentValue, // Usa o valor extraído ou o último conhecido
                            source: 'Legal One - Manual',
                        }
                    });
                }

                // Passo 4: Atualiza o ativo principal com os dados enriquecidos e o valor mais recente
                await tx.creditAsset.update({
                    where: { id: creditAssetId },
                    data: {
                        ...mappedLawsuitData,
                        currentValue: latestCurrentValue,
                        status: 'Ativo',
                    },
                });
            });

            console.log(`✅ Ativo ${creditAssetId} enriquecido e ${manualUpdates.length} andamentos sincronizados!`);

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

