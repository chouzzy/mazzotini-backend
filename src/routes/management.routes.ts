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
import { TestGetDocumentsController } from '../modules/users/useCases/testGetDocuments/TestGetDocumentsController';
import { TestMonthlyUpdateController } from '../modules/creditAssets/useCases/testMonthlyUpdate/TestMonthlyUpdateController';
import { GetUserByIdController } from '../modules/management/useCases/getUserById/GetUserByIdController';
import { AdminUpdateUserController } from '../modules/management/useCases/adminUpdateUser/AdminUpdateUserController';
import { AdminDeleteUserDocumentController } from '../modules/management/useCases/adminDeleteUserDocument/AdminDeleteUserDocumentController';
import { UpdateUserInvestmentsController } from '../modules/management/useCases/updateUserInvestments/UpdateUserInvestmentsController';
import { UploadInvestmentDocumentController } from '../modules/management/useCases/uploadInvestmentDocument/UploadInvestmentDocumentController';
import uploadConfig from '../config/upload';
import multer from 'multer';
import { AdminUploadUserDocumentController } from '../modules/management/useCases/adminUploadUserDocument/AdminUploadUserDocumentController';


const managementRoutes = Router();
const listManagementUsersController = new ListManagementUsersController();
const listAllRolesController = new ListAllRolesController();
const updateUserRolesController = new UpdateUserRolesController();
const inviteUserController = new InviteUserController(); // 2. Crie a instância
const listPendingUsersController = new ListPendingUsersController();
const approveUserProfileController = new ApproveUserProfileController();
const rejectUserProfileController = new RejectUserProfileController();
const testGetDocumentsController = new TestGetDocumentsController();
const testMonthlyUpdateController = new TestMonthlyUpdateController();
const getUserByIdController = new GetUserByIdController();
const adminUpdateUserController = new AdminUpdateUserController();
const adminDeleteUserDocumentController = new AdminDeleteUserDocumentController();
const updateUserInvestmentsController = new UpdateUserInvestmentsController();
const uploadInvestmentDocumentController = new UploadInvestmentDocumentController();
const adminUploadUserDocumentController = new AdminUploadUserDocumentController();
const upload = multer(uploadConfig);



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

// --- ROTA DE ESPIONAGEM TEMPORÁRIA ---
/**
 * @route   GET /api/management/spy-docs/:lawsuitId
 * @desc    [DEBUG] Retorna o JSON completo do primeiro documento de um processo.
 * @access  Privado (Apenas para ADMINs)
 */
managementRoutes.get(
    '/api/management/spy-docs/:lawsuitId',
    testGetDocumentsController.handle // 3. ADICIONAR A ROTA
);


/**
 * @route   GET /api/management/test-monthly-update
 * @desc    [TESTE] Força a execução do cron de atualização monetária mensal.
 * @access  Privado (Apenas ADMINs)
 */
managementRoutes.get(
    '/api/management/test-monthly-update',
    // checkJwt,
    // checkRole([ROLES.ADMIN]), // Protegido
    testMonthlyUpdateController.handle
);



/**
 * @route   GET /api/management/users/:id
 * @desc    Busca detalhes de um usuário específico
 * @access  Privado (ADMIN)
 */
managementRoutes.get(
    '/api/management/users/:id',
    checkJwt,
    checkRole([ROLES.ADMIN]),
    getUserByIdController.handle
);

/**
 * @route   PATCH /api/management/users/:id
 * @desc    Atualiza dados de um usuário específico
 * @access  Privado (ADMIN)
 */
managementRoutes.patch(
    '/api/management/users/:id',
    checkJwt,
    checkRole([ROLES.ADMIN]),
    adminUpdateUserController.handle
);

/**
 * @route   DELETE /api/management/users/:id/documents
 * @desc    Deleta um documento pessoal de um usuário (Admin)
 * @access  Privado (Apenas para ADMINs)
 */

// Rota de Delete de Documento (Admin)
managementRoutes.delete(
    '/api/management/users/:id/documents',
    checkJwt,
    checkRole([ROLES.ADMIN]),
    adminDeleteUserDocumentController.handle
);

/** 
 * @route   PATCH /api/management/users/:id/investments
 * @desc    Atualiza os investimentos de um usuário específico
 * @access  Privado (ADMIN)
*/
managementRoutes.patch(
    '/api/management/users/:id/investments',
    checkJwt,
    checkRole([ROLES.ADMIN]),
    updateUserInvestmentsController.handle
);

/** 
 * @route   POST /api/management/users/:id/investments/documents]
 * @desc    Upload de documentos de investimento para um usuário específico
 * @access  Privado (ADMIN)
*/

// Rota para atualizar a carteira do usuário
managementRoutes.patch(
    '/api/management/users/:id/investments',
    checkJwt,
    checkRole([ROLES.ADMIN]),
    updateUserInvestmentsController.handle
);

/** 
 * @route   POST /api/management/users/:id/investments/documents
 * @desc    Upload de documentos de investimento para um usuário específico
 * @access  Privado (ADMIN)
*/

// Rota para upload de documentos de investimento
managementRoutes.post(
    '/api/management/users/:id/investments/documents',
    checkJwt,
    checkRole([ROLES.ADMIN]),
    upload.single('document'),
    uploadInvestmentDocumentController.handle
);

/** 
 * @route   POST /api/management/users/:id/documents
 * @desc    Upload de documentos pessoais para um usuário específico (Admin)
 * @access  Privado (ADMIN)
*/

// Rota de Upload de Documento PESSOAL pelo Admin (gestão)
managementRoutes.post(
    '/api/management/users/:id/documents',
    checkJwt,
    checkRole([ROLES.ADMIN]),
    upload.single('document'), // Usa o middleware do multer configurado
    adminUploadUserDocumentController.handle
);

export { managementRoutes };
