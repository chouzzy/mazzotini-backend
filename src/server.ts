// /src/server.ts
import { app } from './app';
import { startScheduledJobs } from './cron';
import { runMonthlyIndexUpdate } from './schedulers/cronJob';

const PORT = Number(process.env.PORT) || 8080;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor a rodar na porta ${PORT} e a ouvir em todas as interfaces.`);
    startScheduledJobs();
    runMonthlyIndexUpdate();
});
