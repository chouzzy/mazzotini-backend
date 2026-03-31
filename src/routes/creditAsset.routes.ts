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
import { DeleteCreditAssetController } from '../modules/creditAssets/useCases/deleteCreditAsset/DeleteCreditAssetController';
import { ImportNewAssetsController } from '../modules/creditAssets/useCases/importNewAssets/ImportNewAssetsController';
import { ListAllFoldersController } from '../modules/creditAssets/useCases/listAllFolders/ListAllFoldersController';
import { ROLES } from '../types';

const creditAssetRoutes = Router();
const createCreditAssetController = new CreateCreditAssetController();
const enrichAssetFromLegalOneController = new EnrichAssetFromLegalOneController();
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


// --- NOVA ROTA DE BUSCA ---
/**
 * @route   GET /api/assets/lookup/:processNumber
 * @desc    Busca dados de um processo no Legal One para pré-preenchimento.
 * @access  Privado (ADMIN, OPERATOR)
 */
creditAssetRoutes.get(
    '/api/assets/lookup/:processNumber',
    checkJwt, // Garante que o usuário está logado
    checkRole([ROLES.ADMIN, ROLES.OPERATOR]), // Bloqueia investidores de buscarem processos aleatórios
    lookupAssetFromLegalOneController.handle 
);
// --- FIM DA NOVA ROTA ---


/**
 * @route   GET /api/assets/:processNumber
 * @desc    Busca os detalhes completos de um ativo de crédito específico.
 * @access  Privado (Todos os perfis)
 */
creditAssetRoutes.get(
    '/api/assets/:processNumber',
    checkJwt,
    checkRole([ROLES.ADMIN, ROLES.OPERATOR, ROLES.INVESTOR, ROLES.ASSOCIATE]), // Proteção de perfil
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