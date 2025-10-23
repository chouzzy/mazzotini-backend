// /src/routes/user.routes.ts

import { Router } from 'express';
import { checkJwt } from '../middleware/auth';
import multer from 'multer';

// --- Controllers ---
import { CreateUserController } from '../modules/users/useCases/createUser/CreateUserController';
import { ListUsersController } from '../modules/users/useCases/listUsers/ListUsersController';
import { UpdateMyProfileController } from '../modules/users/useCases/updateMyProfile/UpdateMyProfileController';
import { GetMyProfileController } from '../modules/users/useCases/getMyProfile/GetMyProfileController';
import { ResendVerificationEmailController } from '../modules/users/useCases/resendVerificationEmail/ResendVerificationEmailController';
import { ListAssociatesController } from '../modules/users/useCases/listAssociates/ListAssociatesController';
// NOVAS IMPORTAÇÕES
import { UploadProfilePictureController } from '../modules/users/useCases/uploadProfilePicture/UploadProfilePictureController';
import { UploadPersonalDocumentController } from '../modules/users/useCases/uploadPersonalDocument/UploadPersonalDocumentController';


// Configuração do Multer para guardar os ficheiros em memória
const upload = multer({ storage: multer.memoryStorage() });

const userRoutes = Router();

// --- Instâncias dos Controllers ---
const createUserController = new CreateUserController();
const listUsersController = new ListUsersController();
const updateMyProfileController = new UpdateMyProfileController();
const getMyProfileController = new GetMyProfileController();
const resendVerificationEmailController = new ResendVerificationEmailController();
const listAssociatesController = new ListAssociatesController(); // Adicionado da nossa etapa anterior
// NOVAS INSTÂNCIAS
const uploadProfilePictureController = new UploadProfilePictureController();
const uploadPersonalDocumentController = new UploadPersonalDocumentController();


// ============================================================================
//  DEFINIÇÃO DAS ROTAS DE UTILIZADOR
// ============================================================================

/**
 * @route   POST /api/users
 * @desc    Endpoint chamado pela Action do Auth0 para sincronizar um novo utilizador.
 */
userRoutes.post(
    '/api/users',
    createUserController.handle
);

/**
 * @route   GET /api/users
 * @desc    Lista todos os usuários para preencher selects no frontend.
 * @access  Privado (Requer token JWT válido)
 */
userRoutes.get(
    '/api/users',
    checkJwt, 
    listUsersController.handle 
);

/**
 * @route   GET /api/users/associates
 * @desc    Busca a lista de utilizadores com a role 'ASSOCIATE'
 * @access  Privado (Requer token JWT válido)
 */
userRoutes.get(
    '/api/users/associates',
    checkJwt,
    listAssociatesController.handle
);


/**
 * @route   GET /api/users/me
 * @desc    Busca os dados do utilizador autenticado a partir da nossa base de dados.
 */
userRoutes.get(
    '/api/users/me',
    checkJwt,
    getMyProfileController.handle
);

/**
 * @route   PATCH /api/users/me/profile
 * @desc    Permite que o utilizador autenticado atualize o seu próprio perfil (dados de texto).
 */
userRoutes.patch(
    '/api/users/me/profile',
    checkJwt,
    updateMyProfileController.handle
);

/**
 * @route   POST /api/users/me/profile-picture
 * @desc    Faz o upload de uma nova foto de perfil.
 */
userRoutes.post(
    '/api/users/me/profile-picture',
    checkJwt,
    upload.single('profilePicture'), // O multer processa o ficheiro com o nome 'profilePicture'
    uploadProfilePictureController.handle
);

/**
 * @route   POST /api/users/me/personal-document
 * @desc    Faz o upload de um novo documento pessoal.
 */
userRoutes.post(
    '/api/users/me/personal-document',
    checkJwt,
    upload.single('document'), // O multer processa o ficheiro com o nome 'document'
    uploadPersonalDocumentController.handle
);

/**
 * @route   POST /api/users/me/resend-verification
 * @desc    Aciona o reenvio do e-mail de verificação para o utilizador autenticado.
 */
userRoutes.post(
    '/api/users/me/resend-verification',
    checkJwt,
    resendVerificationEmailController.handle
);

export { userRoutes };
