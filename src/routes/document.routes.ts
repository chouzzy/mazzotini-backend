// /src/routes/document.routes.ts
import { Router } from 'express';
import { checkJwt } from '../middleware/auth';
import { GetDownloadUrlController } from '../modules/documents/useCases/getDownloadUrl/GetDownloadUrlController';

const documentRoutes = Router();
const getDownloadUrlController = new GetDownloadUrlController();

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
