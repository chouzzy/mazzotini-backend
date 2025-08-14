// src/routes/user.routes.ts

import { Router } from 'express';

// --- Middlewares ---
import { checkJwt } from '../middleware/auth'; // O nosso "segurança" da API

// --- Controllers ---
import { CreateUserController } from '../modules/users/useCases/createUser/CreateUserController';

// --- Inicialização ---
const userRoutes = Router();

// Cria uma instância do nosso controller
const createUserController = new CreateUserController();

// ============================================================================
//   DEFINIÇÃO DAS ROTAS DE UTILIZADOR
// ============================================================================

/**
 * @route   POST /api/users
 * @desc    Cria um novo utilizador no banco de dados (e no Auth0).
 * @access  Privado (Requer token JWT válido de um OPERATOR ou ADMIN)
 */
userRoutes.post(
    '/api/users',
    createUserController.handle // 2. Se estiver, o controller processa a requisição
);

// Adicione aqui outras rotas para o CRUD de utilizadores no futuro
// Ex: userRoutes.get('/api/users', checkJwt, listUsersController.handle);

export { userRoutes };
