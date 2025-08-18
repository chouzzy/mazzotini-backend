// src/routes/investment.routes.ts

import { Router } from 'express';

// --- Middlewares ---
import { checkJwt } from '../middleware/auth';

// --- Controllers ---
import { ListMyInvestmentsController } from '../modules/investments/useCases/listMyInvestments/ListMyInvestmentsController';

// --- Inicialização ---
const investmentRoutes = Router();
const listMyInvestmentsController = new ListMyInvestmentsController();

// ============================================================================
//  DEFINIÇÃO DAS ROTAS DE INVESTIMENTOS
// ============================================================================

/**
 * @route   GET /api/investments/me
 * @desc    Busca todos os investimentos do usuário autenticado.
 * @access  Privado (Requer token JWT válido)
 */
investmentRoutes.get(
  '/api/investments/me',
  checkJwt, // Garante que o usuário está logado
  listMyInvestmentsController.handle
);

export { investmentRoutes };