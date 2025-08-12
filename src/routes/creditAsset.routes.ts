// src/routes/creditAsset.routes.ts

import { Router } from 'express';

// --- Middlewares ---
import { checkJwt } from '../middleware/auth'; // O nosso "segurança" da API

// --- Controllers ---
import { CreateCreditAssetController } from '../modules/creditAssets/useCases/createCreditAsset/CreateCreditAssetController';

// --- Inicialização ---
const creditAssetRoutes = Router();

// Cria uma instância do nosso controller
const createCreditAssetController = new CreateCreditAssetController();

// ============================================================================
//   DEFINIÇÃO DAS ROTAS DE ATIVOS DE CRÉDITO
// ============================================================================

/**
 * @route   POST /api/assets
 * @desc    Cria um novo ativo de crédito no banco de dados.
 * @access  Privado (Requer token JWT válido e, futuramente, uma role de OPERATOR ou ADMIN)
 */
creditAssetRoutes.post(
    '/api/assets',
    checkJwt, // 1. O "segurança" verifica se o utilizador está autenticado
    createCreditAssetController.handle // 2. Se estiver, o controller processa a requisição
);

// Adicione aqui outras rotas para o CRUD de ativos no futuro
// Ex: creditAssetRoutes.get('/api/assets', checkJwt, listAssetsController.handle);
// Ex: creditAssetRoutes.put('/api/assets/:id', checkJwt, updateAssetController.handle);

export { creditAssetRoutes };
