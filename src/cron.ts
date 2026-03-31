import cron from 'node-cron';
import { SyncProcessUpdatesUseCase } from './modules/creditAssets/useCases/syncProcessUpdates/SyncProcessUpdatesUseCase';
import { ImportNewAssetsUseCase } from './modules/creditAssets/useCases/importNewAssets/ImportNewAssetsUseCase';

const syncUseCase = new SyncProcessUpdatesUseCase();
const importUseCase = new ImportNewAssetsUseCase();

/**
 * Inicia todos os jobs agendados da aplicação.
 */
export const startScheduledJobs = () => {
    console.log("⏰ Agendador de tarefas iniciado.");

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

};

