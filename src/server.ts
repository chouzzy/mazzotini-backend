// src/server.ts

import dotenv from 'dotenv';
dotenv.config();

import 'reflect-metadata';
import express, { NextFunction, Request, Response } from 'express';
import { router } from './routes';
import { AppError } from './errors/AppError';
import cors from 'cors';
import { startScheduledJobs } from './cron';

const app = express();

app.use(cors({
    origin: '*',
    methods: ['GET', 'PUT', 'POST', 'DELETE', 'PATCH'],
    credentials: true,
}));

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