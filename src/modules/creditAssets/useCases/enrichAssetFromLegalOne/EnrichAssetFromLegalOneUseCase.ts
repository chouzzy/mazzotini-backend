import { PrismaClient } from "@prisma/client";
import { legalOneApiService, LegalOneLawsuit, LegalOneUpdate } from "../../../../services/legalOneApiService"; 

const prisma = new PrismaClient();

// ============================================================================
//  FUNÇÃO "TRADUTORA" (MAPEADORA DE DADOS) ATUALIZADA
// ============================================================================
const mapLegalOneDataToAsset = async (lawsuit: LegalOneLawsuit, updates: LegalOneUpdate[]) => {
    let originalCreditorName = 'Não identificado';

    // 1. Encontra o participante que é a "outra parte" (o credor)
    const creditorParticipant = lawsuit.participants?.find(p => p.type === 'OtherParty');
    
    // 2. Se encontrou, busca o nome real dele na API
    if (creditorParticipant?.contactId) {
        try {
            const contactDetails = await legalOneApiService.getContactDetails(creditorParticipant.contactId);
            originalCreditorName = contactDetails.name;
        } catch (error) {
            console.error(`[MAP] Erro ao buscar nome do credor para o contactId: ${creditorParticipant.contactId}`, error);
            originalCreditorName = `Erro ao buscar Contato ID: ${creditorParticipant.contactId}`;
        }
    }
    
    // Lógica para encontrar a atualização de crédito
    // Hipótese: o andamento manual terá "crédito" na descrição e o valor em 'notes'.
    const creditUpdate = updates.find(upd => upd.description.toLowerCase().includes('crédito'));
    
    // Extrai o valor do andamento, se encontrado. Se não, usa o valor da causa.
    let currentValue = lawsuit.monetaryAmount?.Value || 0;
    if (creditUpdate && creditUpdate.notes) {
         // Hipótese: o valor está em 'notes' como "Valor: R$ 12345.67".
         // Esta lógica precisará ser ajustada para o formato real.
         const valueMatch = creditUpdate.notes.match(/Valor: R\$ ([\d,.]+)/);
         if (valueMatch && valueMatch[1]) {
            currentValue = parseFloat(valueMatch[1].replace('.', '').replace(',', '.'));
         }
    }

    return {
        originalCreditor: originalCreditorName,
        originalValue: lawsuit.monetaryAmount?.Value || 0,
        currentValue: currentValue, // Valor atualizado a partir do andamento
        // ... outros campos
    };
};

// ============================================================================
//  O USE CASE REATORADO
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
            // Passo 1: Busca os dados principais do processo
            const lawsuitData = await legalOneApiService.getProcessDetails(asset.processNumber);
            
            // Passo 2: Usa o ID do processo para buscar os andamentos
            const updatesData = await legalOneApiService.getProcessUpdates(lawsuitData.id);
            console.log(`[Enrich] Encontrados ${updatesData.length} andamentos para o processo ${asset.processNumber}`);
            console.log('Updates:', updatesData);
            
            // Passo 3: "Traduz" os dados combinados para o nosso formato
            const mappedData = await mapLegalOneDataToAsset(lawsuitData, updatesData);
            
            await prisma.creditAsset.update({
                where: { id: creditAssetId },
                data: {
                    ...mappedData,
                    status: 'Ativo',
                },
            });

            console.log(`✅ Ativo ${creditAssetId} enriquecido com sucesso, incluindo andamentos!`);

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

