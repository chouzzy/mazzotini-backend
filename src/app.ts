import dotenv from 'dotenv';
dotenv.config();

import 'reflect-metadata';
import express, { NextFunction, Request, Response } from 'express';
import { router } from './routes';
import { AppError } from './errors/AppError';
import cors from 'cors';

const app = express();

const allowedOrigins = [
    'http://localhost:3000',
    'https://mazzotini-frontend.vercel.app',
    'https://portal.mazzotiniadvogados.com.br',
    'https://mazzotini-backup.netlify.app'
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

app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

app.use(router);

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
    }
    return res.status(500).json({
        status: 'error',
        message: `⛔ Internal Server Error: ${err.message}⛔`
    });
});

export { app };
