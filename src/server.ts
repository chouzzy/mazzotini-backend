// /src/server.ts
import dotenv from 'dotenv';
dotenv.config();

import 'reflect-metadata';
import express, { NextFunction, Request, Response } from 'express';
import { router } from './routes';
import { AppError } from './errors/AppError';
import cors from 'cors';
import { startScheduledJobs } from './cron';

const app = express();

// ============================================================================
//  CONFIGURAÇÃO DE CORS (A SOLUÇÃO PROFISSIONAL)
// ============================================================================
// 1. Define uma "lista branca" de origens permitidas
const allowedOrigins = [
    'http://localhost:3000', // O seu ambiente de desenvolvimento
    'https://mazzotini-frontend.vercel.app', // A sua URL de produção
    // Adicione a sua URL de deploy da Vercel aqui (ex: https://mazzotini.vercel.app)
];

app.use(cors({
    origin: function (origin, callback) {
        // Permite requisições da nossa "lista branca" (ou sem origem, como o Postman)
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.warn(`[CORS] Origem bloqueada: ${origin}`);
            callback(new Error('Origem não permitida pelo CORS'));
        }
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS'], // Permite todos os métodos
    allowedHeaders: ['Content-Type', 'Authorization'], // 2. PERMITE O CABEÇALHO DE AUTORIZAÇÃO
    credentials: true,
}));

// 3. Habilita o "preflight" (OPTIONS) para TODAS as rotas
// Isto responde automaticamente a todas as requisições OPTIONS
app.options('*', cors());
// ============================================================================


app.use(express.json());

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
});

