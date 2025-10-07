// /src/routes/management.routes.ts
import { Router } from 'express';
import { checkJwt } from '../middleware/auth';
import { checkRole } from '../middleware/checkRole';
import { ListManagementUsersController } from '../modules/management/useCases/listUsers/ListManagementUsersController';
import { ListAllRolesController } from '../modules/management/useCases/listAllRoles/ListAllRolesController';
import { UpdateUserRolesController } from '../modules/management/useCases/updateUserRoles/UpdateUserRolesController';
import { InviteUserController } from '../modules/management/useCases/inviteUser/InviteUserController'; // 1. Importe o novo controller

const managementRoutes = Router();
const listManagementUsersController = new ListManagementUsersController();
const listAllRolesController = new ListAllRolesController();
const updateUserRolesController = new UpdateUserRolesController();
const inviteUserController = new InviteUserController(); // 2. Crie a instância

const ROLES = {
    ADMIN: process.env.ROLE_ADMIN || 'ADMIN',
};

/**
 * @route   GET /api/management/users
 * @desc    Busca a lista completa de utilizadores e suas roles a partir do Auth0.
 * @access  Privado (Apenas para ADMINs)
 */
managementRoutes.get(
    '/api/management/users',
    checkJwt,
    checkRole([ROLES.ADMIN]),
    listManagementUsersController.handle
);

/**
 * @route   GET /api/management/roles
 * @desc    Busca a lista de todas as roles disponíveis no Auth0.
 * @access  Privado (Apenas para ADMINs)
 */
managementRoutes.get(
    '/api/management/roles',
    checkJwt,
    checkRole([ROLES.ADMIN]),
    listAllRolesController.handle
);

/**
 * @route   PATCH /api/management/users/:auth0UserId/roles
 * @desc    Atualiza as roles de um utilizador específico.
 * @access  Privado (Apenas para ADMINs)
 */
managementRoutes.patch(
    '/api/management/users/:auth0UserId/roles',
    checkJwt,
    checkRole([ROLES.ADMIN]),
    updateUserRolesController.handle
);

/**
 * @route   POST /api/management/invites
 * @desc    Cria um novo utilizador e envia um convite (e-mail de verificação).
 * @access  Privado (Apenas para ADMINs)
 */
managementRoutes.post(
    '/api/management/invites',
    checkJwt,
    checkRole([ROLES.ADMIN]),
    inviteUserController.handle
);

export { managementRoutes };
