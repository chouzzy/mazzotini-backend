import { Router } from 'express';
import { checkJwt } from '../middleware/auth';
import { checkRole } from '../middleware/checkRole';

import { CreateCreditAssetController } from '../modules/creditAssets/useCases/createCreditAsset/CreateCreditAssetController';
import { GetAssetByProcessNumberController } from '../modules/creditAssets/useCases/getAssetByProcessNumber/GetAssetByProcessNumberController';
import { SyncSingleAssetController } from '../modules/creditAssets/useCases/syncSingleAsset/SyncSingleAssetController';
import { ListAllAssetsController } from '../modules/creditAssets/useCases/listAllAssets/ListAllAssetsController';
import { LookupAssetFromLegalOneController } from '../modules/users/useCases/lookupAssetFromLegalOne/LookupAssetFromLegalOneController';
import { GetAssetEstimationController } from '../modules/creditAssets/useCases/getAssetEstimation/GetAssetEstimationController';
import { UpdateAssetController } from '../modules/creditAssets/useCases/updateAsset/UpdateAssetController';
import { DeleteCreditAssetController } from '../modules/creditAssets/useCases/deleteCreditAsset/DeleteCreditAssetController';
import { ImportNewAssetsController } from '../modules/creditAssets/useCases/importNewAssets/ImportNewAssetsController';
import { ListAllFoldersController } from '../modules/creditAssets/useCases/listAllFolders/ListAllFoldersController';
import { ROLES } from '../types';

const creditAssetRoutes = Router();
const createCreditAssetController = new CreateCreditAssetController();
const getAssetByProcessNumberController = new GetAssetByProcessNumberController();
const syncSingleAssetController = new SyncSingleAssetController();
const listAllAssetsController = new ListAllAssetsController();
const lookupAssetFromLegalOneController = new LookupAssetFromLegalOneController();
const getAssetEstimationController = new GetAssetEstimationController();
const updateAssetController = new UpdateAssetController();
const deleteCreditAssetController = new DeleteCreditAssetController();
const importNewAssetsController = new ImportNewAssetsController();
const listAllFoldersController = new ListAllFoldersController();


/**
 * @route   GET /api/folders
 * @desc    Lista todas as pastas que possuem ativos de crédito, incluindo um resumo dos ativos em cada pasta.
 * @access  Privado (OPERATOR, ADMIN, INVESTOR)
 */
creditAssetRoutes.get(
    '/api/assets/folders',
    checkJwt,
    checkRole([ROLES.ADMIN, ROLES.OPERATOR, ROLES.INVESTOR, ROLES.ASSOCIATE]),
    listAllFoldersController.handle
);


/**
 * @route   POST /api/assets/import
 * @desc    Importa ativos de crédito a partir de um arquivo CSV.
 * @access  Privado (ADMIN)
 */
creditAssetRoutes.post(
    '/api/assets/import', 
    checkJwt, 
    checkRole([ROLES.ADMIN]), 
    importNewAssetsController.handle
);


/**
 * @route   GET /api/assets
 * @desc    Busca um resumo de todos os ativos de crédito.
 * @access  Privado (OPERATOR, ADMIN, ASSOCIATE, INVESTOR)
 */
creditAssetRoutes.get(
    '/api/assets',
    checkJwt,
    checkRole([ROLES.ADMIN, ROLES.OPERATOR, ROLES.INVESTOR, ROLES.ASSOCIATE]),
    listAllAssetsController.handle
);


/**
 * @route   GET /api/assets/lookup/folder/:folderCode
 * @desc    Busca dados de um processo no Legal One pelo código da pasta (ex: Proc-0002091/032).
 * @access  Privado (ADMIN, OPERATOR)
 * Nota: Esta rota DEVE vir antes de lookup/:processNumber para não ser capturada pelo parâmetro genérico.
 */
creditAssetRoutes.get(
    '/api/assets/lookup/folder/:folderCode(*)',
    checkJwt,
    checkRole([ROLES.ADMIN, ROLES.OPERATOR]),
    (req, res) => lookupAssetFromLegalOneController.handleByFolder(req, res)
);

/**
 * @route   GET /api/assets/lookup/:processNumber
 * @desc    Busca dados de um processo no Legal One para pré-preenchimento.
 * @access  Privado (ADMIN, OPERATOR)
 */
creditAssetRoutes.get(
    '/api/assets/lookup/:processNumber',
    checkJwt,
    checkRole([ROLES.ADMIN, ROLES.OPERATOR]),
    lookupAssetFromLegalOneController.handle
);


/**
 * @route   GET /api/assets/:processNumber
 * @desc    Busca os detalhes completos de um ativo de crédito específico.
 * @access  Privado (Todos os perfis)
 */
creditAssetRoutes.get(
    '/api/assets/:legalOneId',
    checkJwt,
    checkRole([ROLES.ADMIN, ROLES.OPERATOR, ROLES.INVESTOR, ROLES.ASSOCIATE]), // Proteção de perfil
    getAssetByProcessNumberController.handle
);

/**
 * @route   POST /api/assets/:legalOneId/sync
 * @desc    Aciona manualmente a sincronização de andamentos para um ativo específico.
 * @access  Privado (OPERATOR, ADMIN)
 */
creditAssetRoutes.post(
    '/api/assets/:legalOneId/sync',
    checkJwt,
    checkRole([ROLES.OPERATOR, ROLES.ADMIN]), // Padronizado para usar o enum
    syncSingleAssetController.handle
);

/**
 * @route   GET /api/assets/:assetId/estimate
 * @desc    Calcula e retorna a estimativa de valor atual de um ativo.
 * @access  Privado (Todos os autenticados)
 */
creditAssetRoutes.get(
    '/api/assets/:assetId/estimate',
    checkJwt,
    checkRole([ROLES.ADMIN, ROLES.OPERATOR, ROLES.INVESTOR, ROLES.ASSOCIATE]),
    getAssetEstimationController.handle
);

/**
 * @route   PATCH /api/assets/:processNumber
 * @desc    Atualiza um ativo de crédito existente.
 * @access  Privado (OPERATOR, ADMIN)
 */
creditAssetRoutes.patch(
    '/api/assets/:legalOneId',
    checkJwt,
    checkRole([ROLES.OPERATOR, ROLES.ADMIN]), // Padronizado para usar o enum
    updateAssetController.handle
);

/**
 * @route   DELETE /api/assets/:id
 * @desc    Deleta um ativo de crédito (soft delete).
 * @access  Privado (ADMIN)
 */

// Rota de Exclusão (Apenas ADMIN)
creditAssetRoutes.delete(
    '/api/assets/:id',
    checkJwt,
    checkRole([ROLES.ADMIN]), // Padronizado para usar o enum
    deleteCreditAssetController.handle
);


/**
 * @route   POST /api/assets
 * @desc    Cria um novo ativo de crédito.
 * @access  Privado (OPERATOR, ADMIN)
 */
creditAssetRoutes.post(
    '/api/assets',
    checkJwt,
    checkRole([ROLES.OPERATOR, ROLES.ADMIN]), // Padronizado para usar o enum
    createCreditAssetController.handle
);


export { creditAssetRoutes };