// src/modules/creditAssets/useCases/enrichAssetFromLegalOne/EnrichAssetFromLegalOneUseCase.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// --- SIMULAÇÃO DA API LEGAL ONE ---
// No futuro, substituiremos esta função pela chamada real à API do Legal One.
const fetchFromLegalOneAPI = async (processNumber: string): Promise<any> => {
    console.log(`[Legal One API Simulação] A buscar dados para o processo: ${processNumber}`);
    
    // Simula um atraso de rede
    await new Promise(resolve => setTimeout(resolve, 2000)); 

    // Retorna dados falsos (mock) que a API nos daria
    return {
        originalCreditor: "Empresa Exemplo Ltda.",
        origemProcesso: "10ª Vara Cível do Foro Central da Comarca de São Paulo",
        valorAjuizado: 50000.00,
        dataBaixaPasta: new Date("2028-12-01"),
        // ... outros campos que a API do Legal One possa fornecer
    };
};
// ------------------------------------


/**
 * @class EnrichAssetFromLegalOneUseCase
 * @description Contém a lógica de negócio para buscar dados no Legal One e enriquecer um ativo de crédito.
 */
class EnrichAssetFromLegalOneUseCase {
    /**
     * Executa o processo de enriquecimento de dados.
     * @param {string} creditAssetId - O ID do ativo de crédito a ser enriquecido.
     */
    async execute(creditAssetId: string): Promise<void> {
        
        // 1. Busca o ativo "esqueleto" no nosso banco de dados.
        const asset = await prisma.creditAsset.findUnique({
            where: { id: creditAssetId },
        });

        // Valida se o ativo existe e se está pendente de enriquecimento.
        if (!asset || asset.status !== 'PENDING_ENRICHMENT') {
            console.warn(`Ativo ${creditAssetId} não encontrado ou não está pendente. Abortando enriquecimento.`);
            return;
        }

        try {
            // 2. Chama a API do Legal One para buscar os dados detalhados.
            const legalOneData = await fetchFromLegalOneAPI(asset.processNumber);

            // 3. Atualiza o nosso registo do ativo com os dados enriquecidos.
            await prisma.creditAsset.update({
                where: { id: creditAssetId },
                data: {
                    // Preenche os campos que estavam em falta
                    originalCreditor: legalOneData.originalCreditor,
                    origemProcesso: legalOneData.origemProcesso,
                    originalValue: legalOneData.valorAjuizado,
                    settlementDate: legalOneData.dataBaixaPasta,
                    
                    // Atualiza o status para indicar que o processo foi concluído
                    status: 'ACTIVE',
                },
            });

            console.log(`✅ Ativo ${creditAssetId} (Processo: ${asset.processNumber}) enriquecido com sucesso!`);

        } catch (error) {
            console.error(`❌ Erro ao enriquecer o ativo ${creditAssetId}:`, error);
            // Opcional: Atualizar o status para "FAILED_ENRICHMENT" para podermos tentar novamente mais tarde.
            await prisma.creditAsset.update({
                where: { id: creditAssetId },
                data: { status: 'FAILED_ENRICHMENT' },
            });
        }
    }
}

export { EnrichAssetFromLegalOneUseCase };
