import cron from 'node-cron';
import { SyncProcessUpdatesUseCase } from './modules/creditAssets/useCases/syncProcessUpdates/SyncProcessUpdatesUseCase';
import { ImportNewAssetsUseCase } from './modules/creditAssets/useCases/importNewAssets/ImportNewAssetsUseCase';
import { RetryFailedEnrichmentsUseCase } from './modules/creditAssets/useCases/retryFailedEnrichments/RetryFailedEnrichmentsUseCase';
import { SyncFeeContractsUseCase } from './modules/creditAssets/useCases/syncFeeContracts/SyncFeeContractsUseCase';
import { RunCalculationUseCase } from './modules/calculator/useCases/runCalculation/RunCalculationUseCase';
import { prisma } from './prisma';
import { describeIndexLoad, ensureIndexSeriesLoaded, isFirstInstance, updateIndexSeries } from './services/indexUpdateService';
import { describeAsset, notifyRecalculationFailures, RecalculationFailure } from './services/recalculationReport';

const syncUseCase = new SyncProcessUpdatesUseCase();
const importUseCase = new ImportNewAssetsUseCase();
const retryEnrichmentUseCase = new RetryFailedEnrichmentsUseCase();
const syncFeeContractsUseCase = new SyncFeeContractsUseCase();
const runCalculationUseCase = new RunCalculationUseCase();

/**
 * Inicia todos os jobs agendados da aplicação.
 */
export const startScheduledJobs = () => {
    console.log("⏰ Agendador de tarefas iniciado.");

    // De hora em hora: carrega as séries de índice que o cálculo exige e que ainda estejam vazias
    // (por exemplo, se o BCB estava fora quando o servidor subiu). Com tudo carregado, não faz nada.
    cron.schedule('15 * * * *', async () => {
        try {
            const results = await ensureIndexSeriesLoaded();
            if (results.length > 0) console.log(`[CRON] Carga de índices vazios: ${describeIndexLoad(results)}`);
        } catch (e: any) {
            console.error('[CRON] Falha ao carregar os índices vazios:', e.message);
        }
    }, { timezone: 'America/Sao_Paulo' });

    // Todos os dias à meia-noite: importa processos novos cadastrados no Legal One
    // nas últimas 48h (janela de 2 dias para cobrir eventuais atrasos de cadastro).
    cron.schedule('0 0 * * *', () => {
        console.log('--- Executando job agendado: Importar Novos Processos do Legal One ---');
        const since = new Date();
        since.setDate(since.getDate() - 2); // últimas 48h
        since.setHours(0, 0, 0, 0);
        importUseCase.execute(since);
    }, {
        timezone: "America/Sao_Paulo"
    });

    // Todos os dias à 1h da manhã: sincroniza andamentos dos processos ativos.
    cron.schedule('0 1 * * *', () => {
        console.log('--- Executando job agendado: Sincronizar Andamentos ---');
        syncUseCase.execute();
    }, {
        timezone: "America/Sao_Paulo"
    });

    // Todos os dias às 3h: reprocessa ativos travados em FAILED/PENDING_ENRICHMENT.
    // Roda depois do sync das 1h para a quota do Legal One já ter se recuperado.
    // Sem este job, um único 429 deixava o processo parado para sempre — o sync
    // diário só enxerga `status: 'Ativo'`.
    cron.schedule('0 3 * * *', async () => {
        console.log('--- Executando job agendado: Retentar Enriquecimentos Falhos ---');
        try {
            await retryEnrichmentUseCase.execute();
        } catch (error) {
            console.error('--- FALHA no job de retentativa de enriquecimento:', error);
        }
    }, {
        timezone: "America/Sao_Paulo"
    });

    // Todo dia 5 de cada mês às 04h: atualiza os índices (BCB) e recalcula processos.
    cron.schedule('0 4 5 * *', async () => {
        console.log('--- Executando job agendado: Atualizar Índices e Recalcular Processos ---');
        const now = new Date();
        const year  = now.getFullYear();
        const month = now.getMonth() + 1;

        try {
            // 1. Busca os meses publicados desde o último gravado de cada índice
            await updateIndexSeries(now);

            // 2. Recalcula todos os processos com parâmetros configurados, pelo mesmo
            // caminho do botão "Calcular": mesmos parâmetros, mesmo log, mesmo valor.
            const allParams = await prisma.processCalculationParams.findMany();
            // Número do processo e do Legal One, para o log e o aviso dos recusados
            const assets = await prisma.creditAsset.findMany({
                where:  { id: { in: allParams.map(p => p.assetId) } },
                select: { id: true, legalOneId: true, processNumber: true },
            });
            const assetOf = new Map(assets.map(a => [a.id, a]));
            let ok = 0, withWarnings = 0;
            const failures: RecalculationFailure[] = [];

            for (const params of allParams) {
                try {
                    const result = await runCalculationUseCase.calculateAndSave(params, 'cron', year, month);
                    if (result.warnings?.length) withWarnings++;
                    ok++;
                } catch (e: any) {
                    const asset   = assetOf.get(params.assetId);
                    const failure = { assetId: params.assetId, legalOneId: asset?.legalOneId, processNumber: asset?.processNumber, error: e.message };
                    console.error(`  Erro ao recalcular o processo ${describeAsset(failure)}:`, e.message);
                    failures.push(failure);
                }
            }

            console.log(`  Recálculo concluído: ${ok} sucesso, ${failures.length} falhas, ${withWarnings} com avisos (como um mês ainda sem índice no banco, contado como 0%)`);

            // Um processo recusado mantém o valor anterior: os admins precisam saber quais são
            await notifyRecalculationFailures(failures);
        } catch (e: any) {
            console.error('  Erro crítico no job de índices/recálculo:', e.message);
        }
    }, { timezone: 'America/Sao_Paulo' });

    // Todos os dias às 5h: importa os documentos financeiros anexados aos contratos no
    // Legal One (cessão, honorários, orientações, comprovantes e notas fiscais),
    // identificados pela hashtag do tipo. Antes só rodava pelo botão em Configurações.
    // Roda depois dos jobs da madrugada que usam o Legal One (sync da 1h e retentativa
    // das 3h), para não disputar a cota. Documentos já importados ou com hashtag não
    // reconhecida são pulados sem chamar o Legal One; os novos consultam o contato.
    cron.schedule('0 5 * * *', async () => {
        console.log('--- Executando job agendado: Sincronizar Documentos Financeiros ---');
        try {
            const result = await syncFeeContractsUseCase.execute();
            console.log(`--- Documentos financeiros: ${result.documentsImported} importados, ${result.documentsSkipped} ignorados, ${result.errors.length} com erro.`);
        } catch (error) {
            console.error('--- FALHA no job de documentos financeiros:', error);
        }
    }, {
        timezone: "America/Sao_Paulo"
    });

    // Todos os dias às 6h: grava os índices publicados desde a última execução, sem recalcular.
    // Assim o cálculo manual usa um índice assim que o BCB o publica, como no Dr. Calc, em vez de
    // esperar o dia 5 (o IPCA de um mês sai por volta do dia 10 do seguinte). Usa só o BCB, não o
    // Legal One. Com o PM2 em cluster, só a primeira instância atualiza.
    cron.schedule('0 6 * * *', async () => {
        if (!isFirstInstance()) return;
        console.log('--- Executando job agendado: Atualizar Índices ---');
        try {
            await updateIndexSeries();
        } catch (e: any) {
            console.error('--- FALHA no job de atualização de índices:', e.message);
        }
    }, { timezone: 'America/Sao_Paulo' });
};

