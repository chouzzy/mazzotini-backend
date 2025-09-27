// /src/routes/creditAsset.routes.ts
import { Router } from 'express';
import { checkJwt } from '../middleware/auth';
import { checkRole } from '../middleware/checkRole';

import { CreateCreditAssetController } from '../modules/creditAssets/useCases/createCreditAsset/CreateCreditAssetController';
import { EnrichAssetFromLegalOneController } from '../modules/creditAssets/useCases/enrichAssetFromLegalOne/EnrichAssetFromLegalOneController';
import { GetAssetByProcessNumberController } from '../modules/creditAssets/useCases/getAssetByProcessNumber/GetAssetByProcessNumberController';
import { SyncSingleAssetController } from '../modules/creditAssets/useCases/syncSingleAsset/SyncSingleAssetController';
import { ListAllAssetsController } from '../modules/creditAssets/useCases/listAllAssets/ListAllAssetsController';

const creditAssetRoutes = Router();

const createCreditAssetController = new CreateCreditAssetController();
const enrichAssetFromLegalOneController = new EnrichAssetFromLegalOneController();
const getAssetByProcessNumberController = new GetAssetByProcessNumberController();
const syncSingleAssetController = new SyncSingleAssetController();
const listAllAssetsController = new ListAllAssetsController();

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
 * @access  Privado (OPERATOR, ADMIN)
 */
creditAssetRoutes.get(
    '/api/assets',
    checkJwt,
    checkRole(['OPERATOR', 'ADMIN']),
    listAllAssetsController.handle
);

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

export { creditAssetRoutes };

