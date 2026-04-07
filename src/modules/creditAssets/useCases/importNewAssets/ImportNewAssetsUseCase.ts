/**
 * ImportNewAssetsUseCase.ts — Robô de Importação Massiva de Ativos
 *
 * Responsável pela importação automática (ou incremental) de processos,
 * recursos e incidentes cadastrados no Legal One para o banco de dados local.
 * Acionado via script agendado (cron) ou manualmente pelo endpoint
 * `POST /api/assets/import`.
 *
 * ## Fluxo por Entidade
 * Para cada processo encontrado no Legal One:
 *
 * 1. **Validação** — descarta entidades sem número de processo
 * 2. **Deduplicação** — verifica pelo `legalOneId` se já existe no banco.
 *    Se existir, pula silenciosamente (incrementa `skippedCount`)
 * 3. **Lookup** — chama `LookupAssetFromLegalOneUseCase` para buscar dados
 *    completos (partes, pasta, investidores sugeridos) antes de criar o registro
 * 4. **Criação** — chama `CreateCreditAssetUseCase` com todos os dados enriquecidos
 *
 * ## Throttling
 * Há um `wait(3000)` entre cada entidade para respeitar o rate limit da API do
 * Legal One. Em um import de 200 processos, isso leva ~10 minutos — intencional.
 *
 * ## Relatório Final
 * Ao encerrar, loga um resumo com contadores:
 * - `importedCount` — novos ativos criados com sucesso
 * - `skippedCount`  — entidades já existentes (puladas)
 * - `errorCount`    — falhas individuais (não interrompem o loop)
 *
 * ## Parâmetro Opcional: startDate
 * Se fornecido, busca apenas processos criados APÓS essa data — útil para
 * sincronizações incrementais diárias sem precisar revisar todo o histórico.
 */

// src/modules/creditAssets/useCases/importNewAssets/ImportNewAssetsUseCase.ts

import { PrismaClient } from "@prisma/client";
import { legalOneApiService } from "../../../../services/legalOneApiService";
import { CreateCreditAssetUseCase } from "../createCreditAsset/CreateCreditAssetUseCase";
import { LookupAssetFromLegalOneUseCase } from "../../../users/useCases/lookupAssetFromLegalOne/LookupAssetFromLegalOneUseCase";
import { LegalOneEntity } from "../../../../services/legalOneTypes";

const prisma = new PrismaClient();

class ImportNewAssetsUseCase {
    /**
     * Executa a importação massiva ou incremental de processos, recursos e incidentes.
     * @param startDate (Opcional) Busca processos criados APÓS essa data.
     */
    async execute(startDate?: Date): Promise<void> {

        const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        console.log(`\n==================================================`);
        console.log(`[IMPORT ROBOT] Iniciando execução...`);
        if (startDate) console.log(`   - Desde: ${startDate.toISOString()}`);
        console.log(`==================================================\n`);

        // 1. Busca lista UNIFICADA no Legal One (Lawsuits, Appeals, ProceduralIssues)
        let legalOneEntities: LegalOneEntity[] = [];
        try {
            legalOneEntities = await legalOneApiService.listLawsuits(startDate);
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
            const processNumber = entity.identifierNumber;
            
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
                where: { legalOneId: entity.id }
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
                const investors = (lookupData.suggestedInvestors || []).map((inv: { userId: string; share?: number }) => ({
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