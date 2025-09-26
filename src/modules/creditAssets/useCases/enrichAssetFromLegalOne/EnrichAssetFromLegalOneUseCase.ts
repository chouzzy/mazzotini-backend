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
 * Ainda precisaremos validar o mapeamento final com o documento específico de campos.
 */
const mapLegalOneDataToAsset = (legalOneData: LegalOneLawsuit) => {
    // Hipótese: O "credor original" é a "outra parte" no processo.
    // Isso precisa ser confirmado pela regra de negócio.
    const creditor = legalOneData.participants?.find(p => p.type === 'OtherParty')?.contact?.name;

    return {
        // Nossos campos         <- Campos do Legal One (baseado no schema)
        originalCreditor:       creditor,
        originalValue:          legalOneData.monetaryAmount?.Value,
        
        // O schema não provê a descrição textual destes campos diretamente.
        // Seria necessária uma chamada adicional aos endpoints de "System Tables" 
        // para obter os nomes a partir dos IDs (courtId, actionTypeId, etc.).
        // Por agora, vamos deixar como placeholders a serem preenchidos pelo mapeamento final.
        // origemProcesso:       ...
        // lawsuitType:          ...
        // lawyerResponsible:    ...
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

