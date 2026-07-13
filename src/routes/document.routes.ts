// /src/routes/document.routes.ts
import { Router } from 'express';
import { checkJwt } from '../middleware/auth';
import { GetDownloadUrlController } from '../modules/documents/useCases/getDownloadUrl/GetDownloadUrlController';
import { GetPrivateDocumentsController } from '../modules/documents/useCases/getPrivateDocuments/GetPrivateDocumentsController';

const documentRoutes = Router();
const getDownloadUrlController = new GetDownloadUrlController();
const getPrivateDocumentsController = new GetPrivateDocumentsController();

/**
 * @route   GET /api/documents/private
 * @desc    Lista os documentos PRIVADO_FINANCEIRO do cotista autenticado.
 * @access  Privado
 */
documentRoutes.get(
  '/api/documents/private',
  checkJwt,
  getPrivateDocumentsController.handle
);

/**
 * @route   GET /api/documents/:id/download-url
 * @desc    Gera e retorna uma URL de download temporária para um documento específico.
 * @access  Privado (Requer token JWT válido)
 */
documentRoutes.get(
  '/api/documents/:id/download-url',
  checkJwt,
  getDownloadUrlController.handle
);

export { documentRoutes };
