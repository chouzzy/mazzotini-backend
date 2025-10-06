// /src/routes/management.routes.ts
import { Router } from 'express';
import { checkJwt } from '../middleware/auth';
import { checkRole } from '../middleware/checkRole';
import { ListManagementUsersController } from '../modules/management/listUsers/ListManagementUsersController';

const managementRoutes = Router();
const listManagementUsersController = new ListManagementUsersController();

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

export { managementRoutes };
