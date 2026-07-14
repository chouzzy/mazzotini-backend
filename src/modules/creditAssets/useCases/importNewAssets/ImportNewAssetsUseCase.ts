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
 *    completos (partes, pasta, clientes sugeridos) antes de criar o registro
 * 4. **Criação** — chama `CreateCreditAssetUseCase` com todos os dados enriquecidos
 *
 * ## Throttling
 * Há um `wait(3000)` entre cada entidade para respeitar o rate limit da API do
 * Legal One. Em um import { prisma } from '../../../../prisma';
import de 200 processos, isso leva ~10 minutos — intencional.
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


import { legalOneApiService } from "../../../../services/legalOneApiService";
import { CreateCreditAssetUseCase } from "../createCreditAsset/CreateCreditAssetUseCase";
import { LookupAssetFromLegalOneUseCase } from "../../../users/useCases/lookupAssetFromLegalOne/LookupAssetFromLegalOneUseCase";
import { LegalOneEntity } from "../../../../services/legalOneTypes";
import { getSystemSettings } from "../../../admin/useCases/systemSettings/SystemSettingsService";
import { prisma } from '../../../../prisma';



class ImportNewAssetsUseCase {
    /**
     * Executa a importação massiva ou incremental de processos, recursos e incidentes.
     * @param startDate (Opcional) Busca processos criados APÓS essa data.
     */
    async execute(startDate?: Date, logId?: string): Promise<void> {

        const startTime = Date.now();
        const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        console.log(`\n==================================================`);
        console.log(`[IMPORT ROBOT] Iniciando execução...`);
        if (startDate) console.log(`   - Desde: ${startDate.toISOString()}`);
        console.log(`==================================================\n`);

        // 1. Busca APENAS Lawsuits (Processos Principais) no Legal One.
        //    Appeals e ProceduralIssues são descobertos pela Malha Fina (fluxo separado).
        let legalOneEntities: LegalOneEntity[] = [];
        try {
            const allEntities = await legalOneApiService.listLawsuits(startDate);
            legalOneEntities = allEntities.filter(e => e.__legalOneType === 'Lawsuit');
            const skippedTypes = allEntities.length - legalOneEntities.length;
            console.log(`[IMPORT ROBOT] Total na API: ${allEntities.length} | Apenas Lawsuits: ${legalOneEntities.length} | Recursos/Incidentes ignorados: ${skippedTypes}`);
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

            // Guard: verifica configurações antes de importar recursos/incidentes
            if (typeLabel === 'Appeal' || typeLabel === 'ProceduralIssue') {
                const settings = await getSystemSettings();
                if (typeLabel === 'Appeal' && !settings.autoImportAppeals) {
                    console.log(`[IMPORT ROBOT] ⏸ Recursos desativados nas configurações. Pulando ${processNumber}.`);
                    skippedCount++;
                    continue;
                }
                if (typeLabel === 'ProceduralIssue' && !settings.autoImportProceduralIssues) {
                    console.log(`[IMPORT ROBOT] ⏸ Incidentes desativados nas configurações. Pulando ${processNumber}.`);
                    skippedCount++;
                    continue;
                }
            }

            console.log(`[IMPORT ROBOT] 🚀 Importando novo [${typeLabel}]: ${processNumber}`);

            try {
                // 3. Faz o Lookup 
                const lookupData = await lookupUseCase.execute(processNumber);

                // 4. Prepara clientes sugeridos
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

        const durationMs = Date.now() - startTime;
        console.log(`\n==================================================`);
        console.log(`[IMPORT ROBOT] Finalizado.`);
        console.log(`✅ Importados: ${importedCount}`);
        console.log(`⏩ Pulados: ${skippedCount}`);
        console.log(`❌ Erros: ${errorCount}`);
        console.log(`⏱ Duração: ${Math.round(durationMs / 1000)}s`);
        console.log(`==================================================\n`);

        // Atualiza o log no banco
        if (logId) {
            try {
                await prisma.importLog.update({
                    where: { id: logId },
                    data: {
                        importedCount,
                        skippedCount,
                        errorCount,
                        status: errorCount > 0 && importedCount === 0 ? 'failed' : 'completed',
                        finishedAt: new Date(),
                        durationMs,
                    },
                });
            } catch (e: any) {
                console.error('[IMPORT ROBOT] Falha ao atualizar log:', e.message);
            }
        }
    }
}

export { ImportNewAssetsUseCase };