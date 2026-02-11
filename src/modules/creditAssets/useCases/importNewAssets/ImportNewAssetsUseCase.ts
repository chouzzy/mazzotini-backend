import { PrismaClient } from "@prisma/client";
import { legalOneApiService } from "../../../../services/legalOneApiService";
import { CreateCreditAssetUseCase } from "../createCreditAsset/CreateCreditAssetUseCase";
import { LookupAssetFromLegalOneUseCase } from "../../../users/useCases/lookupAssetFromLegalOne/LookupAssetFromLegalOneUseCase";

const prisma = new PrismaClient();

class ImportNewAssetsUseCase {
    /**
     * Executa a importação massiva ou incremental de processos.
     * @param sinceDate (Opcional) Se fornecido, busca apenas processos criados após essa data (Monitoramento).
     */
    async execute(sinceDate?: Date): Promise<void> {
        console.log(`\n==================================================`);
        console.log(`[IMPORT ROBOT] Iniciando execução (Desde: ${sinceDate ? sinceDate.toISOString() : 'Início dos tempos'})...`);
        console.log(`==================================================\n`);

        // 1. Busca lista no Legal One
        let lawsuits = [];
        try {
            lawsuits = await legalOneApiService.listLawsuits(sinceDate);
            console.log(`[IMPORT ROBOT] Total de processos encontrados na API: ${lawsuits.length}`);
        } catch (error: any) {
            console.error(`[IMPORT ROBOT] Falha fatal ao listar processos: ${error.message}`);
            return;
        }

        const lookupUseCase = new LookupAssetFromLegalOneUseCase();
        const createUseCase = new CreateCreditAssetUseCase();
        
        let importedCount = 0;
        let errorCount = 0;
        let skippedCount = 0;

        for (const lawsuit of lawsuits) {
            const processNumber = lawsuit.identifierNumber;
            
            // =================================================================
            //  A CORREÇÃO: Validação de Nulo
            // =================================================================
            if (!processNumber) {
                console.warn(`⚠️ [IMPORT ROBOT] Processo com ID ${lawsuit.id} não possui número (identifierNumber). Pulando.`);
                skippedCount++;
                continue;
            }
            // =================================================================

            // 2. Verifica se já existe no nosso banco (Evita duplicidade)
            const exists = await prisma.creditAsset.findUnique({ 
                where: { processNumber } 
            });

            if (exists) {
                // console.log(`[IMPORT ROBOT] Processo ${processNumber} já existe. Pulando.`);
                skippedCount++;
                continue;
            }

            console.log(`[IMPORT ROBOT] 🚀 Importando novo processo: ${processNumber}`);

            try {
                // 3. Faz o Lookup 
                // (Isso já chama os helpers que criam a PASTA e os USUÁRIOS SOMBRA automaticamente!)
                const lookupData = await lookupUseCase.execute(processNumber);

                // 4. Prepara dados para Criação
                // Mapeia os usuários retornados pelo helper para o formato de investidores
                const investors = (lookupData.suggestedInvestors || []).map(inv => ({
                    userId: inv.userId,
                    share: inv.share || 0
                }));

                // 5. Cria o Ativo
                // Usamos valores padrão pois o "Sync" (Enriquecimento) vai corrigir os valores monetários depois
                await createUseCase.execute({
                    processNumber: processNumber,
                    
                    // Dados do Lookup
                    legalOneId: lookupData.legalOneId,
                    legalOneType: lookupData.legalOneType,
                    originalCreditor: lookupData.originalCreditor,
                    origemProcesso: lookupData.origemProcesso,
                    otherParty: lookupData.otherParty || "Parte Contrária não identificada",
                    nickname: lookupData.nickname || null, // Opcional
                    folderId: lookupData.processFolderId || null,

                    // Valores padrão (placeholder)
                    originalValue: 0, 
                    acquisitionValue: 0,
                    acquisitionDate: new Date(), // Data de hoje como placeholder
                    
                    // Configurações padrão
                    updateIndexType: 'OUTRO', 
                    contractualIndexRate: 0,
                    investors: investors,
                    associateId: null // Sem vendedor vinculado na importação automática
                });

                importedCount++;
                console.log(`✅ [IMPORT ROBOT] Sucesso: ${processNumber} importado com ${investors.length} investidores.`);

            } catch (err: any) {
                errorCount++;
                console.error(`❌ [IMPORT ROBOT] Falha em ${processNumber}:`, err.message);
            }
        }

        console.log(`\n==================================================`);
        console.log(`[IMPORT ROBOT] Finalizado.`);
        console.log(`✅ Importados: ${importedCount}`);
        console.log(`⏩ Pulados (Já existiam ou inválidos): ${skippedCount}`);
        console.log(`❌ Erros: ${errorCount}`);
        console.log(`==================================================\n`);
    }
}

export { ImportNewAssetsUseCase };