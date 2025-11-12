import { Router } from 'express';
import { checkJwt } from '../middleware/auth';
import { checkRole } from '../middleware/checkRole';

import { CreateCreditAssetController } from '../modules/creditAssets/useCases/createCreditAsset/CreateCreditAssetController';
import { EnrichAssetFromLegalOneController } from '../modules/creditAssets/useCases/enrichAssetFromLegalOne/EnrichAssetFromLegalOneController';
import { GetAssetByProcessNumberController } from '../modules/creditAssets/useCases/getAssetByProcessNumber/GetAssetByProcessNumberController';
import { SyncSingleAssetController } from '../modules/creditAssets/useCases/syncSingleAsset/SyncSingleAssetController';
import { ListAllAssetsController } from '../modules/creditAssets/useCases/listAllAssets/ListAllAssetsController';
import { LookupAssetFromLegalOneController } from '../modules/users/useCases/lookupAssetFromLegalOne/LookupAssetFromLegalOneController';
import { GetAssetEstimationController } from '../modules/creditAssets/useCases/getAssetEstimation/GetAssetEstimationController';
import { UpdateAssetController } from '../modules/creditAssets/useCases/updateAsset/UpdateAssetController';




const creditAssetRoutes = Router();
const createCreditAssetController = new CreateCreditAssetController();
const enrichAssetFromLegalOneController = new EnrichAssetFromLegalOneController();
const getAssetByProcessNumberController = new GetAssetByProcessNumberController();
const syncSingleAssetController = new SyncSingleAssetController();
const listAllAssetsController = new ListAllAssetsController();
const lookupAssetFromLegalOneController = new LookupAssetFromLegalOneController();
const getAssetEstimationController = new GetAssetEstimationController();
const updateAssetController = new UpdateAssetController();

/**
 * @route   POST /api/assets
 * @desc    Cria um novo ativo de crédito.
 * @access  Privado (OPERATOR, ADMIN)
 */
creditAssetRoutes.post(
    '/api/assets',
    checkJwt,
    checkRole(['OPERATOR', 'ADMIN']),
    createCreditAssetController.handle
);

/**
 * @route   GET /api/assets
 * @desc    Busca um resumo de todos os ativos de crédito.
 * @access  Privado (OPERATOR, ADMIN, ASSOCIATE, INVESTOR)
 */
creditAssetRoutes.get(
    '/api/assets',
    checkJwt,
    checkRole(['OPERATOR', 'ADMIN', 'ASSOCIATE', 'INVESTOR']),
    listAllAssetsController.handle
);


// --- NOVA ROTA DE BUSCA ---
/**
 * @route   GET /api/assets/lookup/:processNumber
 * @desc    Busca dados de um processo no Legal One para pré-preenchimento.
 * @access  Privado (Todos autenticados)
 */
creditAssetRoutes.get(
    '/api/assets/lookup/:processNumber',
    checkJwt, // Garante que o usuário está logado
    lookupAssetFromLegalOneController.handle // 3. USAR O CONTROLLER
);
// --- FIM DA NOVA ROTA ---


/**
 * @route   GET /api/assets/:processNumber
 * @desc    Busca os detalhes completos de um ativo de crédito específico.
 * @access  Privado (Todos os autenticados)
 */
creditAssetRoutes.get(
    '/api/assets/:processNumber',
    checkJwt,
    getAssetByProcessNumberController.handle
);

/**
 * @route   POST /api/assets/:processNumber/sync
 * @desc    Aciona manualmente a sincronização de andamentos para um ativo específico.
 * @access  Privado (OPERATOR, ADMIN)
 */
creditAssetRoutes.post(
    '/api/assets/:processNumber/sync',
    checkJwt,
    checkRole(['OPERATOR', 'ADMIN']),
    syncSingleAssetController.handle
);

/**
 * @route   GET /api/assets/:assetId/estimate
 * @desc    Calcula e retorna a estimativa de valor atual de um ativo.
 * @access  Privado (Todos os autenticados)
 */
creditAssetRoutes.get(
    '/api/assets/:assetId/estimate',
    // checkJwt,
    getAssetEstimationController.handle
);

/**
 * @route   PATCH /api/assets/:processNumber
 * @desc    Atualiza um ativo de crédito existente.
 * @access  Privado (OPERATOR, ADMIN)
 */
creditAssetRoutes.patch(
    '/api/assets/:processNumber',
    checkJwt,
    checkRole(['OPERATOR', 'ADMIN']), // Protege a rota
    updateAssetController.handle
);

export { creditAssetRoutes };