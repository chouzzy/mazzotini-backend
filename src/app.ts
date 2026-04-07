/**
 * app.ts — Configuração principal do servidor Express
 *
 * Responsabilidades:
 *  - CORS: lista de origens permitidas (frontend Vercel, portal, localhost)
 *  - Body parser: JSON e form-data (limite de 500mb para uploads)
 *  - Rotas: todas registradas via /src/routes/index.ts
 *  - Swagger UI: disponível em /api-docs (desenvolvimento e produção)
 *  - Error handler global: converte AppError em respostas HTTP padronizadas
 */

import dotenv from 'dotenv';
dotenv.config();

import 'reflect-metadata';
import express, { NextFunction, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { router } from './routes';
import { AppError } from './errors/AppError';
import { swaggerSpec } from './swagger/swagger.config';
import cors from 'cors';

const app = express();

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Apenas origens conhecidas do frontend podem chamar a API.
// Em desenvolvimento, 'origin: undefined' (requisições diretas como curl/Postman) é permitido.
const allowedOrigins = [
    'http://localhost:3000',
    'https://mazzotini-frontend.vercel.app',
    'https://portal.mazzotiniadvogados.com.br',
    'https://mazzotini-backup.netlify.app',
];

app.use(cors({
    origin: function (origin, callback) {
        // Sem origem = ferramentas CLI/Postman em dev → permite
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

// Responde a preflight requests (OPTIONS) globalmente
app.options('*', cors());

// ─── Body Parsers ─────────────────────────────────────────────────────────────
// Limite alto para suportar uploads de documentos em base64 via JSON
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

// ─── Swagger UI ───────────────────────────────────────────────────────────────
// Documentação interativa da API. Clique em "Authorize" e cole o Bearer token para testar.
// URL: http://localhost:8080/api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'Mazzotini API — Docs',
    swaggerOptions: {
        // Mantém o token entre recarregamentos da página no browser
        persistAuthorization: true,
    },
}));

// ─── Rotas da Aplicação ───────────────────────────────────────────────────────
app.use(router);

// ─── Error Handler Global ─────────────────────────────────────────────────────
// Captura erros lançados por qualquer rota ou middleware.
// AppError → resposta HTTP com statusCode e message específicos.
// Outros erros → 500 genérico (sem vazar stack traces para o cliente).
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
    }
    console.error('[UNHANDLED ERROR]', err);
    return res.status(500).json({
        status: 'error',
        message: `⛔ Internal Server Error: ${err.message}`,
    });
});

export { app };
