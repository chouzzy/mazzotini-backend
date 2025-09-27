import cron from 'node-cron';
import { SyncProcessUpdatesUseCase } from './modules/creditAssets/useCases/syncProcessUpdates/SyncProcessUpdatesUseCase';

const syncUseCase = new SyncProcessUpdatesUseCase();

/**
 * Inicia todos os jobs agendados da aplicação.
 */
export const startScheduledJobs = () => {
    console.log("⏰ Agendador de tarefas iniciado.");

    // Agenda a sincronização para rodar todos os dias à 1h da manhã.
    // O formato é: (minuto hora dia-do-mês mês dia-da-semana)
    // Para testar rapidamente, você pode usar a string '* * * * *' para rodar a cada minuto.
    cron.schedule('0 1 * * *', () => {
        console.log('--- Executando job agendado: Sincronizar Andamentos ---');
        syncUseCase.execute();
    }, {
        timezone: "America/Sao_Paulo" // Fuso horário de Brasília
    });

    // ... você pode adicionar outros jobs aqui no futuro
};

