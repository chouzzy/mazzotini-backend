// /src/routes/management.routes.ts
import { Router } from 'express';
import { checkJwt } from '../middleware/auth';
import { checkRole } from '../middleware/checkRole';
import { ListAllRolesController } from '../modules/management/listAllRoles/ListAllRolesController';
import { ListManagementUsersController } from '../modules/management/listUsers/ListManagementUsersController';
import { UpdateUserRolesController } from '../modules/management/updateUserRoles/UpdateUserRolesController';

const managementRoutes = Router();
const listManagementUsersController = new ListManagementUsersController();
const listAllRolesController = new ListAllRolesController();
const updateUserRolesController = new UpdateUserRolesController();


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


export { managementRoutes };
