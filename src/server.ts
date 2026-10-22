// /src/server.ts
import { app } from './app';
import { startScheduledJobs } from './cron';
import { runMonthlyIndexUpdate, runDailyHealthCheck } from './schedulers/cronJob';
import { describeIndexLoad, ensureIndexSeriesLoaded } from './services/indexUpdateService';
import { prisma } from './prisma';

const PORT = Number(process.env.PORT) || 8080;

async function cleanupStaleImports() {
    const updated = await prisma.importLog.updateMany({
        where: { status: 'running' },
        data: { status: 'failed', errorMessage: 'Servidor reiniciado durante a execução.', finishedAt: new Date() },
    });
    if (updated.count > 0) {
        console.log(`[STARTUP] ${updated.count} import(s) zumbi(s) marcado(s) como falho.`);
    }
}

app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 Servidor a rodar na porta ${PORT} e a ouvir em todas as interfaces.`);

    // A limpeza depende do banco e por isso é isolada: se o Mongo estiver
    // indisponível no boot, um throw aqui derrubava silenciosamente TODO o
    // agendamento abaixo — o servidor seguia respondendo HTTP sem nenhum cron
    // registrado, justamente no cenário em que os jobs de recuperação importam.
    try {
        await cleanupStaleImports();
    } catch (error: any) {
        console.error('[STARTUP] Falha ao limpar imports zumbis (seguindo mesmo assim):', error.message);
    }

    startScheduledJobs();
    runMonthlyIndexUpdate();
    runDailyHealthCheck();

    // O cálculo recusa índice sem dados: carrega as séries que ainda estão vazias (a taxa legal e
    // a taxa legal + Tema 1368 depois do deploy, ou o TJPR e o TJMG se o seed não rodou), sem
    // segurar o servidor. Se falhar, o cron de hora em hora tenta de novo.
    ensureIndexSeriesLoaded()
        .then(results => {
            if (results.length > 0) console.log(`[STARTUP] Carga de índices vazios: ${describeIndexLoad(results)}`);
        })
        .catch((error: any) => console.error('[STARTUP] Falha ao carregar os índices vazios:', error.message));
});
