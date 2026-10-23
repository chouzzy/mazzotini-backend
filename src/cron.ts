import cron from 'node-cron';
import { SyncProcessUpdatesUseCase } from './modules/creditAssets/useCases/syncProcessUpdates/SyncProcessUpdatesUseCase';
import { ImportNewAssetsUseCase } from './modules/creditAssets/useCases/importNewAssets/ImportNewAssetsUseCase';
import { RetryFailedEnrichmentsUseCase } from './modules/creditAssets/useCases/retryFailedEnrichments/RetryFailedEnrichmentsUseCase';
import { SyncFeeContractsUseCase } from './modules/creditAssets/useCases/syncFeeContracts/SyncFeeContractsUseCase';
import { describeIndexLoad, ensureIndexSeriesLoaded, isFirstInstance, notifyStaleIndexes, updateIndexSeries } from './services/indexUpdateService';
import {
    describeRecalculation, LAST_RESUME_DAY, resumeMonthlyRecalculationIfPending, runMonthlyRecalculation,
} from './services/monthlyRecalculation';

const syncUseCase = new SyncProcessUpdatesUseCase();
const importUseCase = new ImportNewAssetsUseCase();
const retryEnrichmentUseCase = new RetryFailedEnrichmentsUseCase();
const syncFeeContractsUseCase = new SyncFeeContractsUseCase();

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
        // Retoma o recálculo do dia 5 que foi pulado ou interrompido (até o dia 10)
        try {
            const summary = await resumeMonthlyRecalculationIfPending();
            if (summary) console.log(`[CRON] Recálculo mensal retomado. ${describeRecalculation(summary)}`);
        } catch (e: any) {
            console.error('[CRON] Falha ao retomar o recálculo mensal (tenta de novo na próxima hora):', e.message);
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

    // Todo dia 5 de cada mês às 04h: atualiza os índices (BCB) e recalcula os processos com
    // parâmetros de cálculo, pelo mesmo caminho do botão "Calcular". Se este horário for pulado ou
    // a execução parar no meio, o job de hora em hora retoma (services/monthlyRecalculation.ts).
    cron.schedule('0 4 5 * *', async () => {
        console.log('--- Executando job agendado: Atualizar Índices e Recalcular Processos ---');
        try {
            const summary = await runMonthlyRecalculation();
            if (summary) console.log(`  ${describeRecalculation(summary)}`);
        } catch (e: any) {
            console.error(`  Erro no recálculo mensal (é retomado de hora em hora até o dia ${LAST_RESUME_DAY}):`, e.message);
        }
    }, { timezone: 'America/Sao_Paulo' });

    // Todos os dias às 5h: importa os documentos financeiros anexados aos contratos no
    // Legal One (cessão, honorários, orientações, comprovantes e notas fiscais),
    // identificados pela hashtag do tipo. Antes só rodava pelo botão em Configurações.
    // Roda depois dos jobs da madrugada que usam o Legal One (sync da 1h e retentativa
    // das 3h), para não disputar a cota. Documentos já importados ou com hashtag não
    // reconhecida são pulados sem chamar o Legal One; os novos consultam o contato.
    cron.schedule('0 5 * * *', async () => {
        // Com o PM2 em cluster, duas instâncias criariam o mesmo documento duas vezes
        if (!isFirstInstance()) return;
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
            // Um índice mais atrasado que o normal quer dizer que a atualização parou: avisa os admins
            await notifyStaleIndexes();
        } catch (e: any) {
            console.error('--- FALHA no job de atualização de índices:', e.message);
        }
    }, { timezone: 'America/Sao_Paulo' });
};

