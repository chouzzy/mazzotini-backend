// /src/routes/management.routes.ts
import { Router } from 'express';
import { checkJwt } from '../middleware/auth';
import { checkRole } from '../middleware/checkRole';
import { ListManagementUsersController } from '../modules/management/useCases/listUsers/ListManagementUsersController';
import { ListAllRolesController } from '../modules/management/useCases/listAllRoles/ListAllRolesController';
import { UpdateUserRolesController } from '../modules/management/useCases/updateUserRoles/UpdateUserRolesController';
import { InviteUserController } from '../modules/management/useCases/inviteUser/InviteUserController'; // 1. Importe o novo controller
import { ApproveUserProfileController } from '../modules/management/useCases/approveUserProfile/ApproveUserProfileController';
import { ListPendingUsersController } from '../modules/management/useCases/listPendingUsers/ListPendingUsersController';
import { RejectUserProfileController } from '../modules/management/useCases/rejectUserProfile/RejectUserProfileController';

const managementRoutes = Router();
const listManagementUsersController = new ListManagementUsersController();
const listAllRolesController = new ListAllRolesController();
const updateUserRolesController = new UpdateUserRolesController();
const inviteUserController = new InviteUserController(); // 2. Crie a instância
const listPendingUsersController = new ListPendingUsersController();
const approveUserProfileController = new ApproveUserProfileController();
const rejectUserProfileController = new RejectUserProfileController();

const ROLES = {
    ADMIN: process.env.ROLE_ADMIN || 'ADMIN',
};

/**
 * @route   GET /api/management/users
 * @desc    Busca a lista completa de utilizadores e suas roles a partir do Auth0.
 * @access  Privado (Apenas para ADMINs)
 */
managementRoutes.post(
    '/api/management/invites',
    checkJwt,
    checkRole([ROLES.ADMIN]),
    inviteUserController.handle
);

/**
 * @route   GET /api/management/pending-users
 * @desc    Busca a lista de perfis que aguardam aprovação.
 * @access  Privado (Apenas para ADMINs)
 */
managementRoutes.get(
    '/api/management/pending-users',
    checkJwt,
    checkRole([ROLES.ADMIN]),
    listPendingUsersController.handle
);

/**
 * @route   PATCH /api/management/users/:id/approve
 * @desc    Aprova um perfil pendente, muda o status e cria o contato no Legal One.
 * @access  Privado (Apenas para ADMINs)
 */
managementRoutes.patch(
    '/api/management/users/:id/approve', // Usa o ID do nosso banco
    checkJwt,
    checkRole([ROLES.ADMIN]),
    approveUserProfileController.handle
);

/**
 * @route   PATCH /api/management/users/:id/reject
 * @desc    Rejeita um perfil pendente e muda o status.
 * @access  Privado (Apenas para ADMINs)
 */
managementRoutes.patch(
    '/api/management/users/:id/reject', // Usa o ID do nosso banco
    checkJwt,
    checkRole([ROLES.ADMIN]),
    rejectUserProfileController.handle
);

export { managementRoutes };
