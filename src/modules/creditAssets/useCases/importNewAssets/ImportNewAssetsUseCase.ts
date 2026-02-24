// src/modules/creditAssets/useCases/importNewAssets/ImportNewAssetsUseCase.ts

import { PrismaClient } from "@prisma/client";
import { legalOneApiService } from "../../../../services/legalOneApiService";
import { CreateCreditAssetUseCase } from "../createCreditAsset/CreateCreditAssetUseCase";
import { LookupAssetFromLegalOneUseCase } from "../../../users/useCases/lookupAssetFromLegalOne/LookupAssetFromLegalOneUseCase";

const prisma = new PrismaClient();

class ImportNewAssetsUseCase {
    /**
     * Executa a importação massiva ou incremental de processos, recursos e incidentes.
     * @param startDate (Opcional) Busca processos criados APÓS essa data.
     * @param endDate (Opcional) Busca processos criados ANTES dessa data.
     */
    async execute(startDate?: Date, endDate?: Date): Promise<void> {

        const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        console.log(`\n==================================================`);
        console.log(`[IMPORT ROBOT] Iniciando execução...`);
        if (startDate) console.log(`   - Desde: ${startDate.toISOString()}`);
        if (endDate) console.log(`   - Até:   ${endDate.toISOString()}`);
        console.log(`==================================================\n`);

        // 1. Busca lista UNIFICADA no Legal One (Lawsuits, Appeals, ProceduralIssues)
        let legalOneEntities: any[] = [];
        try {
            // O seu listLawsuits atualizado agora deve suportar startDate e endDate
            legalOneEntities = await legalOneApiService.listLawsuits(startDate, endDate);
            console.log(`[IMPORT ROBOT] Total de entidades encontradas na API: ${legalOneEntities.length}`);
        } catch (error: any) {
            console.error(`[IMPORT ROBOT] Falha fatal ao listar processos: ${error.message}`);
            return;
        }

        const lookupUseCase = new LookupAssetFromLegalOneUseCase();
        const createUseCase = new CreateCreditAssetUseCase();
        
        let importedCount = 0;
        let errorCount = 0;
        let skippedCount = 0;

        for (const entity of legalOneEntities) {
            // O Legal One usa 'identifierNumber' (Lawsuits) ou 'number' (Appeals/Issues)
            const processNumber = entity.identifierNumber || entity.number;
            
            // =================================================================
            //  Validação de Nulo
            // =================================================================
            if (!processNumber) {
                console.warn(`⚠️ [IMPORT ROBOT] Entidade ID ${entity.id} não possui número de processo. Pulando.`);
                skippedCount++;
                continue;
            }

            // 2. Verifica se já existe no banco (Evita duplicidade)
            const exists = await prisma.creditAsset.findUnique({ 
                where: { processNumber } 
            });

            if (exists) {
                skippedCount++;
                continue;
            }

            const typeLabel = entity.__legalOneType || 'Lawsuit';
            console.log(`[IMPORT ROBOT] 🚀 Importando novo [${typeLabel}]: ${processNumber}`);

            try {
                // 3. Faz o Lookup 
                const lookupData = await lookupUseCase.execute(processNumber);

                // 4. Prepara investidores sugeridos
                const investors = (lookupData.suggestedInvestors || []).map((inv: any) => ({
                    userId: inv.userId,
                    share: inv.share || 0
                }));

                // 5. Cria o Ativo
                await createUseCase.execute({
                    processNumber: processNumber,
                    
                    legalOneId: lookupData.legalOneId || entity.id,
                    legalOneType: typeLabel, // 'Lawsuit', 'Appeal' ou 'ProceduralIssue'
                    
                    originalCreditor: lookupData.originalCreditor,
                    origemProcesso: lookupData.origemProcesso,
                    otherParty: lookupData.otherParty || "Parte Contrária não identificada",
                    nickname: lookupData.nickname || null,
                    
                    // Nota: O folderId pode vir vazio aqui se o Lookup não o encontrar.
                    // O seu script `sync-folders.ts` rodará depois para organizar isso.
                    folderId: lookupData.processFolderId || null,

                    originalValue: 0, 
                    acquisitionValue: 0,
                    acquisitionDate: new Date(), 
                    
                    updateIndexType: 'OUTRO', 
                    contractualIndexRate: 0,
                    investors: investors,
                    associateId: null
                });

                importedCount++;
                console.log(`✅ [IMPORT ROBOT] Sucesso: ${processNumber} (${typeLabel}) importado.`);

            } catch (err: any) {
                errorCount++;
                console.error(`❌ [IMPORT ROBOT] Falha em ${processNumber}:`, err.message);
            }

            await wait(3000);
        }

        console.log(`\n==================================================`);
        console.log(`[IMPORT ROBOT] Finalizado.`);
        console.log(`✅ Importados: ${importedCount}`);
        console.log(`⏩ Pulados: ${skippedCount}`);
        console.log(`❌ Erros: ${errorCount}`);
        console.log(`==================================================\n`);
    }
}

export { ImportNewAssetsUseCase };