// src/routes/creditAsset.routes.ts

import { Router } from 'express';

// --- Middlewares ---
import { checkJwt } from '../middleware/auth'; // O nosso "segurança" da API

// --- Controllers ---
import { CreateCreditAssetController } from '../modules/creditAssets/useCases/createCreditAsset/CreateCreditAssetController';
// 1. Importa o novo controller de enriquecimento
import { EnrichAssetFromLegalOneController } from '../modules/creditAssets/useCases/enrichAssetFromLegalOne/EnrichAssetFromLegalOneController';
import { GetAssetByProcessNumberController } from '../modules/creditAssets/useCases/getAssetByProcessNumber/GetAssetByProcessNumberController';

// --- Inicialização ---
const creditAssetRoutes = Router();

// Cria instâncias dos nossos controllers
const createCreditAssetController = new CreateCreditAssetController();
const enrichAssetFromLegalOneController = new EnrichAssetFromLegalOneController();
const getAssetByProcessNumberController = new GetAssetByProcessNumberController();
// ============================================================================
//   DEFINIÇÃO DAS ROTAS DE ATIVOS DE CRÉDITO
// ============================================================================

/**
 * @route   POST /api/assets
 * @desc    Cria um novo "esqueleto" de ativo e dispara o enriquecimento de dados.
 * @access  Privado (Requer token JWT válido)
 */
creditAssetRoutes.post(
    '/api/assets',
    checkJwt,
    createCreditAssetController.handle
);

/**
 * @route   POST /api/assets/:id/enrich
 * @desc    Aciona manualmente o processo de enriquecimento de dados para um ativo específico.
 * @access  Privado (Requer token JWT válido)
 */
creditAssetRoutes.post(
    '/api/assets/:id/enrich', // A rota inclui o ID do ativo
    checkJwt,
    enrichAssetFromLegalOneController.handle
);


/**
 * @route   GET /api/assets/:processNumber
 * @desc    Busca os detalhes completos de um ativo de crédito específico.
 * @access  Privado (Requer token JWT válido)
 */
creditAssetRoutes.get(
    '/api/assets/:processNumber',
    checkJwt,
    getAssetByProcessNumberController.handle
);

// Adicione aqui outras rotas para o CRUD de ativos no futuro
// Ex: creditAssetRoutes.get('/api/assets', checkJwt, listAssetsController.handle);
// Ex: creditAssetRoutes.put('/api/assets/:id', checkJwt, updateAssetController.handle);

export { creditAssetRoutes };
