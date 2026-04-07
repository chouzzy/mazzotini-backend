/**
 * creditAsset.routes.ts — Rotas de Ativos Judiciais
 *
 * Módulo central da plataforma. Cobre todo o ciclo de vida de um ativo:
 *  - Listagem e busca (com filtros, paginação e busca textual)
 *  - Criação manual e importação em lote
 *  - Sincronização com o Legal One (andamentos, documentos, malha fina)
 *  - Estimativa de valor atualizado (cálculo de índices)
 *  - Edição e exclusão
 *
 * Ordem importa: rotas com prefixo específico (/lookup/folder, /lookup/:n)
 * DEVEM ser declaradas antes de /:legalOneId para evitar captura prematura pelo param genérico.
 */

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

// Instâncias dos controllers (um por use case)
const createCreditAssetController      = new CreateCreditAssetController();
const getAssetByProcessNumberController = new GetAssetByProcessNumberController();
const syncSingleAssetController        = new SyncSingleAssetController();
const listAllAssetsController          = new ListAllAssetsController();
const lookupAssetFromLegalOneController = new LookupAssetFromLegalOneController();
const getAssetEstimationController     = new GetAssetEstimationController();
const updateAssetController            = new UpdateAssetController();
const deleteCreditAssetController      = new DeleteCreditAssetController();
const importNewAssetsController        = new ImportNewAssetsController();
const listAllFoldersController         = new ListAllFoldersController();


// ─────────────────────────────────────────────────────────────────────────────
//  PASTAS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/assets/folders:
 *   get:
 *     summary: Lista todas as pastas com seus ativos
 *     description: Retorna as pastas (ProcessFolders) cadastradas, cada uma com o resumo dos ativos vinculados. Usado na tela de Pastas do portal.
 *     tags: [Pastas]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de pastas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ProcessFolder'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
creditAssetRoutes.get(
    '/api/assets/folders',
    checkJwt,
    checkRole([ROLES.ADMIN, ROLES.OPERATOR, ROLES.INVESTOR, ROLES.ASSOCIATE]),
    listAllFoldersController.handle
);


// ─────────────────────────────────────────────────────────────────────────────
//  IMPORTAÇÃO EM LOTE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/assets/import:
 *   post:
 *     summary: Importa ativos do Legal One em lote
 *     description: |
 *       Aciona o robô de importação que busca todos os processos no Legal One
 *       e os cadastra no banco caso ainda não existam (idempotente).
 *       Pode receber uma `startDate` para importação incremental.
 *     tags: [Ativos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               startDate:
 *                 type: string
 *                 format: date
 *                 description: Se fornecido, importa apenas processos criados após esta data.
 *                 example: '2025-01-01'
 *     responses:
 *       200:
 *         description: Importação concluída (ver logs do servidor para detalhes)
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
creditAssetRoutes.post(
    '/api/assets/import',
    checkJwt,
    checkRole([ROLES.ADMIN]),
    importNewAssetsController.handle
);


// ─────────────────────────────────────────────────────────────────────────────
//  LISTAGEM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/assets:
 *   get:
 *     summary: Lista todos os ativos de crédito (com filtros e paginação)
 *     description: |
 *       Retorna um resumo paginado de todos os ativos. Suporta filtros por status,
 *       pasta, número do processo e busca textual. Investidores só veem seus próprios ativos.
 *     tags: [Ativos]
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
 *         description: Busca por número do processo, credor ou parte contrária
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: folderId
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Lista paginada de ativos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CreditAssetSummary'
 *                 meta:
 *                   $ref: '#/components/schemas/PaginatedMeta'
 */
creditAssetRoutes.get(
    '/api/assets',
    checkJwt,
    checkRole([ROLES.ADMIN, ROLES.OPERATOR, ROLES.INVESTOR, ROLES.ASSOCIATE]),
    listAllAssetsController.handle
);


// ─────────────────────────────────────────────────────────────────────────────
//  LOOKUP NO LEGAL ONE
//  ATENÇÃO: estas rotas devem ficar ANTES de /:legalOneId
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/assets/lookup/folder/{folderCode}:
 *   get:
 *     summary: Busca processo no Legal One pelo código de pasta
 *     description: |
 *       Consulta a API do Legal One usando o código da pasta (ex: Proc-0002091/032).
 *       Usado no formulário de novo processo para pré-preenchimento.
 *       O `folderCode` pode conter barras — por isso usa `(*)` no Express.
 *     tags: [Legal One]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: folderCode
 *         required: true
 *         schema: { type: string }
 *         example: Proc-0002091/032
 *     responses:
 *       200:
 *         description: Dados do processo encontrado no Legal One
 *       404:
 *         description: Pasta não encontrada no Legal One
 */
creditAssetRoutes.get(
    '/api/assets/lookup/folder/:folderCode(*)',
    checkJwt,
    checkRole([ROLES.ADMIN, ROLES.OPERATOR]),
    (req, res) => lookupAssetFromLegalOneController.handleByFolder(req, res)
);

/**
 * @swagger
 * /api/assets/lookup/{processNumber}:
 *   get:
 *     summary: Busca processo no Legal One pelo número judicial
 *     description: |
 *       Consulta a API do Legal One usando o número CNJ do processo.
 *       Retorna dados para pré-preenchimento do formulário e sugere investidores vinculados.
 *     tags: [Legal One]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: processNumber
 *         required: true
 *         schema: { type: string }
 *         example: 1021601-47.1997.8.26.0100
 *     responses:
 *       200:
 *         description: Dados do processo + investidores sugeridos
 *       404:
 *         description: Processo não encontrado no Legal One
 */
creditAssetRoutes.get(
    '/api/assets/lookup/:processNumber',
    checkJwt,
    checkRole([ROLES.ADMIN, ROLES.OPERATOR]),
    lookupAssetFromLegalOneController.handle
);


// ─────────────────────────────────────────────────────────────────────────────
//  CRUD POR legalOneId
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/assets/{legalOneId}:
 *   get:
 *     summary: Retorna os detalhes completos de um ativo
 *     description: Inclui andamentos, documentos, investidores e estimativa de valor.
 *     tags: [Ativos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: legalOneId
 *         required: true
 *         schema: { type: integer }
 *         example: 7078
 *     responses:
 *       200:
 *         description: Ativo encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreditAssetSummary'
 *       404:
 *         description: Ativo não encontrado
 */
creditAssetRoutes.get(
    '/api/assets/:legalOneId',
    checkJwt,
    checkRole([ROLES.ADMIN, ROLES.OPERATOR, ROLES.INVESTOR, ROLES.ASSOCIATE]),
    getAssetByProcessNumberController.handle
);

/**
 * @swagger
 * /api/assets/{legalOneId}/sync:
 *   post:
 *     summary: Sincroniza andamentos e documentos de um ativo com o Legal One
 *     description: |
 *       Busca novos andamentos e documentos (com a tag #RelatórioMAA) no Legal One
 *       e os salva no banco. Também executa a "Malha Fina" para detectar processos
 *       filhos (Recursos e Incidentes) ainda não cadastrados.
 *     tags: [Ativos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: legalOneId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Sincronização concluída
 *       404:
 *         description: Ativo não encontrado no banco
 *       500:
 *         description: Falha na comunicação com o Legal One
 */
creditAssetRoutes.post(
    '/api/assets/:legalOneId/sync',
    checkJwt,
    checkRole([ROLES.OPERATOR, ROLES.ADMIN]),
    syncSingleAssetController.handle
);

/**
 * @swagger
 * /api/assets/{assetId}/estimate:
 *   get:
 *     summary: Calcula a estimativa de valor atual do ativo
 *     description: |
 *       Aplica o índice configurado (IPCA, IGPM, Selic, etc.) sobre o valor de aquisição
 *       acumulando a variação mês a mês até a data atual. Retorna o valor estimado atualizado.
 *     tags: [Ativos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assetId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Estimativa calculada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 estimatedValue: { type: 'number', example: 97300.50 }
 *                 indexUsed:      { type: 'string', example: 'IGPM' }
 */
creditAssetRoutes.get(
    '/api/assets/:assetId/estimate',
    checkJwt,
    checkRole([ROLES.ADMIN, ROLES.OPERATOR, ROLES.INVESTOR, ROLES.ASSOCIATE]),
    getAssetEstimationController.handle
);

/**
 * @swagger
 * /api/assets/{legalOneId}:
 *   patch:
 *     summary: Atualiza campos de um ativo existente
 *     description: Permite editar credor, valor original, índice de atualização, nickname e outros metadados.
 *     tags: [Ativos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: legalOneId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nickname:         { type: string }
 *               originalCreditor: { type: string }
 *               originalValue:    { type: number }
 *               acquisitionValue: { type: number }
 *               updateIndexType:  { type: string }
 *     responses:
 *       200:
 *         description: Ativo atualizado
 *       404:
 *         description: Ativo não encontrado
 */
creditAssetRoutes.patch(
    '/api/assets/:legalOneId',
    checkJwt,
    checkRole([ROLES.OPERATOR, ROLES.ADMIN]),
    updateAssetController.handle
);

/**
 * @swagger
 * /api/assets/{id}:
 *   delete:
 *     summary: Remove um ativo do banco de dados
 *     description: |
 *       Remove permanentemente o ativo e todos os seus registros relacionados
 *       (andamentos, documentos e investimentos). Operação irreversível — apenas ADMIN.
 *     tags: [Ativos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Ativo removido com sucesso
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
creditAssetRoutes.delete(
    '/api/assets/:id',
    checkJwt,
    checkRole([ROLES.ADMIN]),
    deleteCreditAssetController.handle
);

/**
 * @swagger
 * /api/assets:
 *   post:
 *     summary: Cria um novo ativo de crédito
 *     description: |
 *       Cadastra um novo processo no banco. Automaticamente:
 *       - Cria o processo pai (Lawsuit) se o ativo for um recurso/incidente
 *       - Cria registros de investimento para cada cotista informado
 *       - Agenda o enriquecimento via Legal One (malha fina)
 *     tags: [Ativos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [processNumber, legalOneId, originalCreditor, origemProcesso, originalValue, acquisitionValue, acquisitionDate, updateIndexType]
 *             properties:
 *               processNumber:    { type: string, example: '1021601-47.1997.8.26.0100' }
 *               legalOneId:       { type: integer, example: 7078 }
 *               legalOneType:     { type: string, enum: ['Lawsuit', 'Appeal', 'ProceduralIssue'] }
 *               originalCreditor: { type: string, example: 'Portus Capital Holding' }
 *               origemProcesso:   { type: string, example: '1ª Vara Cível de SP' }
 *               originalValue:    { type: number, example: 450000 }
 *               acquisitionValue: { type: number, example: 85000 }
 *               acquisitionDate:  { type: string, format: 'date' }
 *               updateIndexType:  { type: string, example: 'IGPM' }
 *               investors:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     userId: { type: string }
 *                     share:  { type: number, example: 30 }
 *     responses:
 *       201:
 *         description: Ativo criado com sucesso
 *       400:
 *         description: Dados inválidos ou faltando
 *       409:
 *         description: Ativo com este legalOneId já existe
 */
creditAssetRoutes.post(
    '/api/assets',
    checkJwt,
    checkRole([ROLES.OPERATOR, ROLES.ADMIN]),
    createCreditAssetController.handle
);


export { creditAssetRoutes };
