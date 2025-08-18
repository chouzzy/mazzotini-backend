// src/routes/user.routes.ts

import { Router } from 'express';

// --- Middlewares ---
import { checkJwt } from '../middleware/auth';
// import { checkRole } from '../middleware/checkRole'; // 1. Importa o novo middleware de role

// --- Controllers ---
import { CreateUserController } from '../modules/users/useCases/createUser/CreateUserController';
import { ListUsersController } from '../modules/users/useCases/listUsers/ListUsersController'; // 2. Importa o novo controller de listagem

// --- Inicialização ---
const userRoutes = Router();

// Cria instâncias dos nossos controllers
const createUserController = new CreateUserController();
const listUsersController = new ListUsersController(); // 3. Cria a instância do novo controller

// ============================================================================
//   DEFINIÇÃO DAS ROTAS DE UTILIZADOR
// ============================================================================

/**
 * @route   POST /api/users
 * @desc    Endpoint chamado pela Action do Auth0 para sincronizar um novo utilizador.
 * @access  Público (protegido por uma chave de API na Action, mas sem JWT de usuário)
 */
userRoutes.post(
    '/api/users',
    createUserController.handle
);

/**
 * @route   GET /api/users
 * @desc    Lista todos os usuários para preencher selects no frontend.
 * @access  Privado (Requer token JWT válido de um OPERATOR ou ADMIN)
 */
userRoutes.get(
    '/api/users',
    checkJwt, // Primeiro, garante que o usuário está autenticado
    // checkRole(['ADMIN', 'OPERATOR']), // Depois, garante que tem a role correta
    listUsersController.handle // Se tudo estiver OK, processa a requisição
);

export { userRoutes };