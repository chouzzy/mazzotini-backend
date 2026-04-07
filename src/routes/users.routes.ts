/**
 * users.routes.ts — Rotas de Perfil do Usuário Autenticado
 *
 * Cobre as ações que o próprio usuário pode fazer no seu perfil:
 *  - Sync com Auth0 ao fazer login (criação ou merge de conta)
 *  - Leitura e edição dos próprios dados
 *  - Upload de foto e documentos pessoais
 *  - Listagem de outros usuários (para selects no frontend)
 */

import { Router } from 'express';
import { checkJwt } from '../middleware/auth';
import multer from 'multer';

import { CreateUserController } from '../modules/users/useCases/createUser/CreateUserController';
import { ListUsersController } from '../modules/users/useCases/listUsers/ListUsersController';
import { UpdateMyProfileController } from '../modules/users/useCases/updateMyProfile/UpdateMyProfileController';
import { GetMyProfileController } from '../modules/users/useCases/getMyProfile/GetMyProfileController';
import { ResendVerificationEmailController } from '../modules/users/useCases/resendVerificationEmail/ResendVerificationEmailController';
import { ListAssociatesController } from '../modules/users/useCases/listAssociates/ListAssociatesController';
import { UploadProfilePictureController } from '../modules/users/useCases/uploadProfilePicture/UploadProfilePictureController';
import { UploadPersonalDocumentController } from '../modules/users/useCases/uploadPersonalDocument/UploadPersonalDocumentController';
import { DeletePersonalDocumentController } from '../modules/users/useCases/deletePersonalDocument/DeletePersonalDocumentController';
import { SyncAuth0UserController } from '../modules/users/useCases/syncAuth0User/SyncAuth0UserController';

// Multer em memória — os arquivos são enviados para o Spaces/S3 diretamente do buffer
const upload = multer({ storage: multer.memoryStorage() });

const userRoutes = Router();

// Instâncias dos controllers
const createUserController            = new CreateUserController();
const listUsersController             = new ListUsersController();
const updateMyProfileController       = new UpdateMyProfileController();
const getMyProfileController          = new GetMyProfileController();
const resendVerificationEmailController = new ResendVerificationEmailController();
const listAssociatesController        = new ListAssociatesController();
const uploadProfilePictureController  = new UploadProfilePictureController();
const uploadPersonalDocumentController = new UploadPersonalDocumentController();
const deletePersonalDocumentController = new DeletePersonalDocumentController();
const syncAuth0UserController         = new SyncAuth0UserController();


// ─────────────────────────────────────────────────────────────────────────────
//  SINCRONIZAÇÃO COM AUTH0
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Cria ou sincroniza um usuário via Auth0 Action
 *     description: |
 *       Endpoint chamado automaticamente pela Action do Auth0 toda vez que um usuário
 *       faz login pela primeira vez. Não deve ser chamado diretamente pelo frontend.
 *       Cria o usuário no banco com status PENDING_ONBOARDING.
 *     tags: [Usuários]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               auth0UserId: { type: string }
 *               email:       { type: string, format: email }
 *               name:        { type: string }
 *               picture:     { type: string, format: uri }
 *     responses:
 *       200:
 *         description: Usuário sincronizado
 */
userRoutes.post('/api/users', createUserController.handle);

/**
 * @swagger
 * /api/users/sync:
 *   post:
 *     summary: Sincroniza o usuário autenticado com o banco de dados
 *     description: |
 *       Chamado pelo frontend logo após o login para garantir que o perfil local
 *       está atualizado com os dados do Auth0 (nome, foto, etc.).
 *       Se for a primeira vez, aplica o merge com usuário sombra (se existir).
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil sincronizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserProfile'
 */
userRoutes.post('/api/users/sync', checkJwt, syncAuth0UserController.handle);


// ─────────────────────────────────────────────────────────────────────────────
//  LISTAGENS (para selects no frontend)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Lista todos os usuários (para selects)
 *     description: Retorna nome e ID de todos os usuários. Usado para preencher seletores de investidor no formulário de ativos.
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de usuários
 */
userRoutes.get('/api/users', checkJwt, listUsersController.handle);

/**
 * @swagger
 * /api/users/associates:
 *   get:
 *     summary: Lista usuários com role ASSOCIATE
 *     description: Usado no formulário de cadastro para o campo de indicação/associado vinculador.
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de associados
 */
userRoutes.get('/api/users/associates', checkJwt, listAssociatesController.handle);


// ─────────────────────────────────────────────────────────────────────────────
//  PERFIL DO USUÁRIO AUTENTICADO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: Retorna o perfil do usuário autenticado
 *     description: |
 *       Busca os dados completos do usuário logado no banco de dados local.
 *       Inclui dados pessoais, endereços, documentos, role e status.
 *       Usado para popular o contexto global da aplicação no frontend.
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil do usuário autenticado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserProfile'
 *       404:
 *         description: Usuário não encontrado no banco
 */
userRoutes.get('/api/users/me', checkJwt, getMyProfileController.handle);

/**
 * @swagger
 * /api/users/me/profile:
 *   patch:
 *     summary: Atualiza o perfil do usuário autenticado
 *     description: |
 *       Permite editar dados pessoais, endereços e preferências de contato.
 *       Se o usuário já for ACTIVE, a alteração é enviada para aprovação (PENDING_REVIEW).
 *       Se ainda estiver em onboarding, os dados são salvos diretamente.
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserProfile'
 *     responses:
 *       200:
 *         description: Perfil atualizado
 */
userRoutes.patch('/api/users/me/profile', checkJwt, updateMyProfileController.handle);


// ─────────────────────────────────────────────────────────────────────────────
//  UPLOADS DO USUÁRIO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/users/me/profile-picture:
 *   post:
 *     summary: Faz upload da foto de perfil
 *     description: Envia a imagem para o Spaces/S3 e atualiza o campo `profilePictureUrl` do usuário.
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               profilePicture:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: URL da foto atualizada
 */
userRoutes.post(
    '/api/users/me/profile-picture',
    checkJwt,
    upload.single('profilePicture'),
    uploadProfilePictureController.handle
);

/**
 * @swagger
 * /api/users/me/personal-document:
 *   post:
 *     summary: Faz upload de documento pessoal (RG, CPF, etc.)
 *     description: Envia o arquivo para o Spaces/S3 e adiciona a URL ao array `personalDocumentUrls`.
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
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
 *         description: Documento adicionado
 */
userRoutes.post(
    '/api/users/me/personal-document',
    checkJwt,
    upload.single('document'),
    uploadPersonalDocumentController.handle
);

/**
 * @swagger
 * /api/users/me/personal-document:
 *   delete:
 *     summary: Remove um documento pessoal do perfil
 *     description: Exclui o arquivo do Spaces/S3 e remove a URL do array do usuário.
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
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
userRoutes.delete('/api/users/me/personal-document', checkJwt, deletePersonalDocumentController.handle);

/**
 * @swagger
 * /api/users/me/resend-verification:
 *   post:
 *     summary: Reenviar e-mail de verificação
 *     description: Solicita ao Auth0 o reenvio do e-mail de verificação para o usuário autenticado.
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: E-mail de verificação reenviado
 */
userRoutes.post('/api/users/me/resend-verification', checkJwt, resendVerificationEmailController.handle);

export { userRoutes };
