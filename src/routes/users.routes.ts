// src/routes/user.routes.ts

import { Router } from 'express';

// --- Middlewares ---
import { checkJwt } from '../middleware/auth';
// import { checkRole } from '../middleware/checkRole'; // 1. Importa o novo middleware de role

// --- Controllers ---
import { CreateUserController } from '../modules/users/useCases/createUser/CreateUserController';
import { ListUsersController } from '../modules/users/useCases/listUsers/ListUsersController'; // 2. Importa o novo controller de listagem
import { UpdateMyProfileController } from '../modules/users/useCases/updateMyProfile/UpdateMyProfileController';
import { GetMyProfileController } from '../modules/users/useCases/getMyProfile/GetMyProfileController';
import { ResendVerificationEmailController } from '../modules/users/useCases/resendVerificationEmail/ResendVerificationEmailController';

// --- Inicialização ---
const userRoutes = Router();

// Cria instâncias dos nossos controllers
const createUserController = new CreateUserController();
const listUsersController = new ListUsersController();
const updateMyProfileController = new UpdateMyProfileController();
const getMyProfileController = new GetMyProfileController();
const resendVerificationEmailController = new ResendVerificationEmailController();

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

/**
 * @route   GET /api/users/me
 * @desc    Busca os dados do utilizador autenticado a partir da nossa base de dados.
 * @access  Privado (Requer token JWT válido)
 */
userRoutes.get(
    '/api/users/me',
    checkJwt,
    getMyProfileController.handle
);

/**
 * @route   PATCH /api/users/me/profile
 * @desc    Permite que o utilizador autenticado atualize o seu próprio perfil.
 * @access  Privado (Requer token JWT válido)
 */
userRoutes.patch(
    '/api/users/me/profile',
    checkJwt,
    updateMyProfileController.handle
);

/**
 * @route   POST /api/users/me/resend-verification
 * @desc    Aciona o reenvio do e-mail de verificação para o utilizador autenticado.
 * @access  Privado (Requer token JWT válido)
 */
userRoutes.post(
    '/api/users/me/resend-verification',
    checkJwt,
    resendVerificationEmailController.handle
);

export { userRoutes };