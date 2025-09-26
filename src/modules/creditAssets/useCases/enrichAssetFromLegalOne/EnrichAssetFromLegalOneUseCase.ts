import { PrismaClient } from "@prisma/client";
// Importa o serviço e a tipagem `LegalOneLawsuit` que definimos com base na documentação
import { legalOneApiService, LegalOneLawsuit } from "../../../../services/legalOneApiService"; 

const prisma = new PrismaClient();

// ============================================================================
//  FUNÇÃO "TRADUTORA" (MAPEADORA DE DADOS) ATUALIZADA
// ============================================================================
/**
 * Mapeia os dados da resposta do Legal One para o nosso modelo de CreditAsset.
 * Esta função isola a lógica de "tradução", facilitando a manutenção.
 * Precisará ser validada com o documento de mapeamento de campos.
 */
const mapLegalOneDataToAsset = (legalOneData: LegalOneLawsuit) => {
    // Hipótese: O "credor original" é a "outra parte" no processo.
    const creditorParticipant = legalOneData.participants?.find(p => p.type === 'OtherParty');
    const originalCreditorName = creditorParticipant ? `Contato ID: ${creditorParticipant.contactId}` : 'A ser confirmado';

    return {
        originalCreditor: originalCreditorName,
        originalValue: legalOneData.monetaryAmount?.Value,
        // ... outros campos a serem mapeados futuramente
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
            console.warn(`Ativo ${creditAssetId} não encontrado ou não está pendente. Abortando enriquecimento.`);
            return;
        }

        try {
            // A chamada ao serviço que busca os dados reais
            const legalOneData = await legalOneApiService.getProcessDetails(asset.processNumber);
            
            // A "tradução" dos dados para o nosso formato
            const mappedData = mapLegalOneDataToAsset(legalOneData);
            console.log(`Dados mapeados para o ativo ${creditAssetId}:`, mappedData);
            
            await prisma.creditAsset.update({
                where: { id: creditAssetId },
                data: {
                    ...mappedData,
                    status: 'Ativo', // O status muda para indicar que o enriquecimento foi bem-sucedido
                },
            });

            console.log(`✅ Ativo ${creditAssetId} (Processo: ${asset.processNumber}) enriquecido com sucesso!`);

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

