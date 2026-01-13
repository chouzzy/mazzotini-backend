// /src/server.ts
import dotenv from 'dotenv';
dotenv.config();

import 'reflect-metadata';
import express, { NextFunction, Request, Response } from 'express';
import { router } from './routes';
import { AppError } from './errors/AppError';
import cors from 'cors';
import { startScheduledJobs } from './cron';
import { runMonthlyIndexUpdate } from './schedulers/cronJob';

const app = express();

// ============================================================================
//  CONFIGURAÇÃO DE CORS
// ============================================================================
const allowedOrigins = [
    'http://localhost:3000',
    'https://mazzotini-frontend.vercel.app',
    'https://portal.mazzotiniadvogados.com.br',
    'https://mazzotini-backup.netlify.app' // (Caso você renomeie, já deixe pronto)
    // Adicione a sua URL de deploy da Vercel aqui
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.warn(`[CORS] Origem bloqueada: ${origin}`);
            callback(new Error('Origem não permitida pelo CORS'));
        }
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
}));

app.options('*', cors());

// ============================================================================
//  CORREÇÃO: Aumentar o Limite de Payload do Express
// ============================================================================
// Por padrão, o Express tem um limite de 100kb. Aumentamos para 50mb.
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
// ============================================================================


// Main
app.use(router);

// Tratamento de erro
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            message: err.message
        });
    }
    return res.status(500).json({
        status: 'error',
        message: `⛔ Internal Server Error: ${err.message}⛔`
    });
});

const PORT = Number(process.env.PORT) || 8080;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor a rodar na porta ${PORT} e a ouvir em todas as interfaces.`);

    startScheduledJobs();
    runMonthlyIndexUpdate()
});

