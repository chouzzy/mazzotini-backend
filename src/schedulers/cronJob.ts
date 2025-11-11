// Em algum lugar como src/schedulers/cronJobs.ts

import { UpdateMonthlyIndicesUseCase } from '../modules/creditAssets/useCases/updateMonthlyIndices/UpdateMonthlyIndicesUseCase';
import cron from 'node-cron';

// ... (seu cron do EnrichAssetFromLegalOneUseCase deve estar aqui)

/**
 * Cron Job: Atualização Monetária Mensal
 * Roda todo dia 1º de cada mês, às 03:00 da manhã.
 */
const runMonthlyIndexUpdate = () => {
    // '0 3 1 * *' = "Às 03:00 no dia 1 de todo mês"
    cron.schedule('0 3 1 * *', async () => {
        console.log("⏰ [Cron] Iniciando Job: UpdateMonthlyIndicesUseCase...");
        
        try {
            const useCase = new UpdateMonthlyIndicesUseCase();
            await useCase.execute();
            console.log("⏰ [Cron] Job: UpdateMonthlyIndicesUseCase concluído com sucesso.");
        } catch (error) {
            console.error("⏰ [Cron] FALHA CRÍTICA no Job: UpdateMonthlyIndicesUseCase:", error);
        }

    }, {
        timezone: "America/Sao_Paulo"
    });
};

// Exporte e chame esta função no seu 'server.ts'
export { runMonthlyIndexUpdate };