import { Router } from 'express';
import { checkJwt } from '../middleware/auth';
import { CreateCreditAssetController } from '../modules/creditAssets/useCases/createCreditAsset/CreateCreditAssetController';
import { EnrichAssetFromLegalOneController } from '../modules/creditAssets/useCases/enrichAssetFromLegalOne/EnrichAssetFromLegalOneController';
import { GetAssetByProcessNumberController } from '../modules/creditAssets/useCases/getAssetByProcessNumber/GetAssetByProcessNumberController';
import { SyncSingleAssetController } from '../modules/creditAssets/useCases/syncSingleAsset/SyncSingleAssetController'; // 1. Importa o novo controller

const creditAssetRoutes = Router();

const createCreditAssetController = new CreateCreditAssetController();
const enrichAssetFromLegalOneController = new EnrichAssetFromLegalOneController();
const getAssetByProcessNumberController = new GetAssetByProcessNumberController();
const syncSingleAssetController = new SyncSingleAssetController(); // 2. Cria a instância

// ... (outras rotas)

/**
 * @route   POST /api/assets/:processNumber/sync
 * @desc    Aciona manualmente a sincronização de andamentos para um ativo específico.
 * @access  Privado (Requer token JWT válido)
 */
creditAssetRoutes.post(
    '/api/assets/:processNumber/sync', // 3. Adiciona a nova rota
    checkJwt,
    syncSingleAssetController.handle
);

// ... (outras rotas)

export { creditAssetRoutes };
