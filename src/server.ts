// /src/server.ts
import { app } from './app';
import { startScheduledJobs } from './cron';
import { runMonthlyIndexUpdate, runDailyHealthCheck } from './schedulers/cronJob';
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
});
