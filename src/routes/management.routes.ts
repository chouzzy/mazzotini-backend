/**
 * management.routes.ts — Rotas de Gestão Administrativa
 *
 * Todas as rotas aqui são restritas a ADMIN.
 * Cobrem o ciclo de vida completo de um usuário na plataforma:
 *  1. Listagem e busca de usuários (com filtros e exportação)
 *  2. Convite de novos usuários
 *  3. Aprovação/Rejeição de cadastros pendentes
 *  4. Edição de dados, documentos e investimentos
 *  5. Fluxo de alteração de perfil (request → review)
 */

import { Router } from 'express';
import { checkJwt } from '../middleware/auth';
import { checkRole } from '../middleware/checkRole';
import { ListManagementUsersController } from '../modules/management/useCases/listUsers/ListManagementUsersController';
import { ListAllRolesController } from '../modules/management/useCases/listAllRoles/ListAllRolesController';
import { UpdateUserRolesController } from '../modules/management/useCases/updateUserRoles/UpdateUserRolesController';
import { InviteUserController } from '../modules/management/useCases/inviteUser/InviteUserController';
import { ApproveUserProfileController } from '../modules/management/useCases/approveUserProfile/ApproveUserProfileController';
import { ListPendingUsersController } from '../modules/management/useCases/listPendingUsers/ListPendingUsersController';
import { RejectUserProfileController } from '../modules/management/useCases/rejectUserProfile/RejectUserProfileController';
import { GetUserByIdController } from '../modules/management/useCases/getUserById/GetUserByIdController';
import { AdminUpdateUserController } from '../modules/management/useCases/adminUpdateUser/AdminUpdateUserController';
import { AdminDeleteUserDocumentController } from '../modules/management/useCases/adminDeleteUserDocument/AdminDeleteUserDocumentController';
import { UpdateUserInvestmentsController } from '../modules/management/useCases/updateUserInvestments/UpdateUserInvestmentsController';
import { UploadInvestmentDocumentController } from '../modules/management/useCases/uploadInvestmentDocument/UploadInvestmentDocumentController';
import uploadConfig from '../config/upload';
import multer from 'multer';
import { AdminUploadUserDocumentController } from '../modules/management/useCases/adminUploadUserDocument/AdminUploadUserDocumentController';
import { RequestProfileChangeController } from '../modules/management/useCases/requestProfileChange/RequestProfileChangeController';
import { ReviewProfileChangeController } from '../modules/management/useCases/reviewProfileChange/ReviewProfileChangeController';
import { ListPendingProfileChangesController } from '../modules/management/useCases/listPendingProfileChanges/ListPendingProfileChangesController';
import { PasswordResetController } from '../modules/management/useCases/passwordReset/PasswordResetController';
import { UpdateUserEmailController } from '../modules/management/useCases/updateUserEmail/UpdateUserEmailController';

const managementRoutes = Router();

// Instâncias dos controllers
const listManagementUsersController    = new ListManagementUsersController();
const listAllRolesController           = new ListAllRolesController();
const updateUserRolesController        = new UpdateUserRolesController();
const inviteUserController             = new InviteUserController();
const listPendingUsersController       = new ListPendingUsersController();
const approveUserProfileController     = new ApproveUserProfileController();
const rejectUserProfileController      = new RejectUserProfileController();
const getUserByIdController            = new GetUserByIdController();
const adminUpdateUserController        = new AdminUpdateUserController();
const adminDeleteUserDocumentController = new AdminDeleteUserDocumentController();
const updateUserInvestmentsController  = new UpdateUserInvestmentsController();
const uploadInvestmentDocumentController = new UploadInvestmentDocumentController();
const adminUploadUserDocumentController = new AdminUploadUserDocumentController();
const requestProfileChangeController   = new RequestProfileChangeController();
const reviewProfileChangeController    = new ReviewProfileChangeController();
const listPendingProfileChangesController = new ListPendingProfileChangesController();
const passwordResetController  = new PasswordResetController();
const updateUserEmailController = new UpdateUserEmailController();

// Multer configurado via /src/config/upload.ts (Spaces/S3)
const upload = multer(uploadConfig);

// Role local (apenas ADMIN tem acesso a todas as rotas deste router)
const ROLES = { ADMIN: process.env.ROLE_ADMIN || 'ADMIN' };


// ─────────────────────────────────────────────────────────────────────────────
//  LISTAGEM E BUSCA DE USUÁRIOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/management/users:
 *   get:
 *     summary: Lista todos os usuários com filtros e paginação
 *     description: |
 *       Retorna a lista paginada de usuários do banco (não do Auth0 diretamente).
 *       Suporta filtros por role, status, busca textual e filtro de usuários "sombra"
 *       (importados do Legal One com email @mazzotini.placeholder).
 *       Inclui o nome do associado vinculado para exportação em Excel.
 *     tags: [Gestão]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Busca por nome ou e-mail
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [ALL, ADMIN, OPERATOR, INVESTOR, ASSOCIATE] }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ALL, ACTIVE, PENDING_REVIEW, PENDING_ONBOARDING] }
 *       - in: query
 *         name: placeholder
 *         schema: { type: boolean }
 *         description: Se true, retorna apenas usuários sombra importados do Legal One
 *     responses:
 *       200:
 *         description: Lista paginada de usuários
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/UserManagementInfo'
 *                 meta:
 *                   $ref: '#/components/schemas/PaginatedMeta'
 */
managementRoutes.get(
    '/api/management/users',
    checkJwt,
    checkRole([ROLES.ADMIN]),
    listManagementUsersController.handle
);

/**
 * @swagger
 * /api/management/roles:
 *   get:
 *     summary: Lista as roles disponíveis
 *     description: Retorna as roles configuradas no sistema (ADMIN, OPERATOR, INVESTOR, ASSOCIATE).
 *     tags: [Gestão]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de roles
 */
managementRoutes.get(
    '/api/management/roles',
    checkJwt,
    checkRole([ROLES.ADMIN]),
    listAllRolesController.handle
);

/**
 * @swagger
 * /api/management/users/{auth0UserId}/roles:
 *   patch:
 *     summary: Atualiza a role de um usuário
 *     description: Muda a permissão de acesso de um usuário. A mudança reflete imediatamente no próximo login.
 *     tags: [Gestão]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: auth0UserId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role: { type: string, enum: [ADMIN, OPERATOR, INVESTOR, ASSOCIATE] }
 *     responses:
 *       200:
 *         description: Role atualizada
 */
managementRoutes.patch(
    '/api/management/users/:auth0UserId/roles',
    checkJwt,
    checkRole([ROLES.ADMIN]),
    updateUserRolesController.handle
);

managementRoutes.post(
    '/api/management/users/:auth0UserId/password-reset',
    checkJwt,
    checkRole([ROLES.ADMIN]),
    passwordResetController.handle
);

managementRoutes.patch(
    '/api/management/users/:auth0UserId/email',
    checkJwt,
    checkRole([ROLES.ADMIN]),
    updateUserEmailController.handle
);


// ─────────────────────────────────────────────────────────────────────────────
//  CONVITES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/management/invites:
 *   post:
 *     summary: Convida um novo usuário para a plataforma
 *     description: |
 *       Cria o usuário no Auth0 com role INVESTOR e envia o e-mail de convite.
 *       O usuário receberá um link para definir sua senha e completar o cadastro.
 *     tags: [Gestão]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, name]
 *             properties:
 *               email: { type: string, format: email }
 *               name:  { type: string }
 *     responses:
 *       201:
 *         description: Convite enviado
 *       409:
 *         description: Usuário já existe com este e-mail
 */
managementRoutes.post(
    '/api/management/invites',
    checkJwt,
    checkRole([ROLES.ADMIN]),
    inviteUserController.handle
);


// ─────────────────────────────────────────────────────────────────────────────
//  APROVAÇÃO / REJEIÇÃO DE CADASTROS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/management/pending-users:
 *   get:
 *     summary: Lista usuários pendentes de aprovação
 *     description: Retorna usuários com status PENDING_REVIEW que aguardam análise do admin.
 *     tags: [Gestão]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de usuários pendentes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/UserProfile'
 */
managementRoutes.get(
    '/api/management/pending-users',
    checkJwt,
    checkRole([ROLES.ADMIN]),
    listPendingUsersController.handle
);

/**
 * @swagger
 * /api/management/users/{id}/approve:
 *   patch:
 *     summary: Aprova o cadastro de um usuário pendente
 *     description: |
 *       Fluxo completo de aprovação:
 *       1. Valida que o usuário está PENDING_REVIEW e tem documentos
 *       2. Busca ou cria o contato no Legal One (por CPF/CNPJ ou RG)
 *       3. Replica os documentos pessoais para o GED do Legal One
 *       4. Atualiza o status para ACTIVE e vincula o legalOneContactId
 *     tags: [Gestão]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: ID do usuário no banco (não o auth0UserId)
 *     responses:
 *       200:
 *         description: Usuário aprovado e ativado com sucesso
 *       409:
 *         description: Usuário não está em status PENDING_REVIEW
 *       422:
 *         description: Perfil incompleto — sem documentos ou e-mail
 */
managementRoutes.patch(
    '/api/management/users/:id/approve',
    checkJwt,
    checkRole([ROLES.ADMIN]),
    approveUserProfileController.handle
);

/**
 * @swagger
 * /api/management/users/{id}/reject:
 *   patch:
 *     summary: Rejeita e exclui o cadastro de um usuário
 *     description: |
 *       Remove o usuário permanentemente do Auth0 e do banco de dados.
 *       Se o Auth0 falhar, a exclusão do banco NÃO ocorre (consistência garantida).
 *       Operação irreversível.
 *     tags: [Gestão]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string, description: Motivo da rejeição (opcional) }
 *     responses:
 *       200:
 *         description: Usuário rejeitado e excluído
 */
managementRoutes.patch(
    '/api/management/users/:id/reject',
    checkJwt,
    checkRole([ROLES.ADMIN]),
    rejectUserProfileController.handle
);


// ─────────────────────────────────────────────────────────────────────────────
//  DETALHE E EDIÇÃO DE USUÁRIO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/management/users/{id}:
 *   get:
 *     summary: Retorna o perfil completo de um usuário
 *     description: Inclui dados pessoais, endereços, documentos, investimentos vinculados e histórico.
 *     tags: [Gestão]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Perfil completo do usuário
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserProfile'
 *       404:
 *         description: Usuário não encontrado
 */
managementRoutes.get(
    '/api/management/users/:id',
    checkJwt,
    checkRole([ROLES.ADMIN]),
    getUserByIdController.handle
);

/**
 * @swagger
 * /api/management/users/{id}:
 *   patch:
 *     summary: Atualiza dados de um usuário (Admin)
 *     description: Permite ao admin editar qualquer campo do perfil sem passar pelo fluxo de aprovação.
 *     tags: [Gestão]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Dados atualizados
 */
managementRoutes.patch(
    '/api/management/users/:id',
    checkJwt,
    checkRole([ROLES.ADMIN]),
    adminUpdateUserController.handle
);


// ─────────────────────────────────────────────────────────────────────────────
//  DOCUMENTOS DO USUÁRIO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/management/users/{id}/documents:
 *   delete:
 *     summary: Remove um documento pessoal do usuário
 *     description: Exclui o arquivo do Spaces/S3 e remove a URL do array no banco.
 *     tags: [Gestão]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               documentUrl: { type: string, format: uri }
 *     responses:
 *       200:
 *         description: Documento removido
 */
managementRoutes.delete(
    '/api/management/users/:id/documents',
    checkJwt,
    checkRole([ROLES.ADMIN]),
    adminDeleteUserDocumentController.handle
);

/**
 * @swagger
 * /api/management/users/{id}/documents:
 *   post:
 *     summary: Faz upload de documento pessoal para um usuário (Admin)
 *     description: |
 *       Envia o arquivo para o Spaces/S3 e adiciona a URL ao array de documentos do usuário.
 *       Validações: tipo MIME (PDF, JPEG, PNG, WebP) e tamanho máximo de 10MB.
 *     tags: [Gestão]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               document:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Documento salvo
 *       413:
 *         description: Arquivo maior que 10MB
 *       415:
 *         description: Tipo de arquivo não permitido
 */
managementRoutes.post(
    '/api/management/users/:id/documents',
    checkJwt,
    checkRole([ROLES.ADMIN]),
    upload.single('document'),
    adminUploadUserDocumentController.handle
);


// ─────────────────────────────────────────────────────────────────────────────
//  INVESTIMENTOS DO USUÁRIO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/management/users/{id}/investments:
 *   patch:
 *     summary: Atualiza a carteira de investimentos de um usuário
 *     description: |
 *       Substitui os registros de investimento do usuário.
 *       Usado na tela de Gestão de Carteira do admin.
 *     tags: [Gestão]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Carteira atualizada
 */
managementRoutes.patch(
    '/api/management/users/:id/investments',
    checkJwt,
    checkRole([ROLES.ADMIN]),
    updateUserInvestmentsController.handle
);

/**
 * @swagger
 * /api/management/users/{id}/investments/documents:
 *   post:
 *     summary: Faz upload de documento de investimento
 *     description: Anexa um arquivo (contrato, boletim) a um investimento específico do usuário.
 *     tags: [Gestão]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               document:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Documento de investimento salvo
 */
managementRoutes.post(
    '/api/management/users/:id/investments/documents',
    checkJwt,
    checkRole([ROLES.ADMIN]),
    upload.single('document'),
    uploadInvestmentDocumentController.handle
);


// ─────────────────────────────────────────────────────────────────────────────
//  FLUXO DE ALTERAÇÃO DE PERFIL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/management/users/{id}/request-change:
 *   post:
 *     summary: Solicita alteração no perfil de um usuário
 *     description: |
 *       Cria uma solicitação de alteração que fica pendente até aprovação.
 *       Permite ao admin propor mudanças sem aplicá-las imediatamente.
 *     tags: [Gestão]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Campos do perfil que devem ser alterados
 *     responses:
 *       201:
 *         description: Solicitação criada
 *       409:
 *         description: Já existe uma solicitação pendente para este usuário
 */
managementRoutes.post(
    '/api/management/users/:id/request-change',
    checkJwt,
    checkRole([ROLES.ADMIN]),
    requestProfileChangeController.handle
);

/**
 * @swagger
 * /api/management/profile-changes:
 *   get:
 *     summary: Lista solicitações de alteração de perfil pendentes
 *     tags: [Gestão]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de solicitações pendentes
 */
managementRoutes.get(
    '/api/management/profile-changes',
    checkJwt,
    checkRole([ROLES.ADMIN]),
    listPendingProfileChangesController.handle
);

/**
 * @swagger
 * /api/management/profile-changes/{requestId}/approve:
 *   patch:
 *     summary: Aprova uma solicitação de alteração de perfil
 *     description: Aplica os dados propostos no perfil do usuário e marca a solicitação como APPROVED.
 *     tags: [Gestão]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Alteração aplicada
 *       409:
 *         description: Solicitação já foi processada
 */
managementRoutes.patch(
    '/api/management/profile-changes/:requestId/approve',
    checkJwt,
    checkRole([ROLES.ADMIN]),
    reviewProfileChangeController.approve
);

/**
 * @swagger
 * /api/management/profile-changes/{requestId}/reject:
 *   patch:
 *     summary: Rejeita uma solicitação de alteração de perfil
 *     tags: [Gestão]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string }
 *     responses:
 *       200:
 *         description: Solicitação rejeitada
 */
managementRoutes.patch(
    '/api/management/profile-changes/:requestId/reject',
    checkJwt,
    checkRole([ROLES.ADMIN]),
    reviewProfileChangeController.reject
);

export { managementRoutes };
