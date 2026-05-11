import { Router } from 'express';
import { checkJwt } from '../middleware/auth';
import { checkRole } from '../middleware/checkRole';
import { GetAssociateDashboardController } from '../modules/associate/useCases/getAssociateDashboard/GetAssociateDashboardController';
import { GetAssociateClientProcessesController } from '../modules/associate/useCases/getAssociateClientProcesses/GetAssociateClientProcessesController';

const associateRoutes = Router();

const getAssociateDashboardController = new GetAssociateDashboardController();
const getAssociateClientProcessesController = new GetAssociateClientProcessesController();

const ROLES = { ASSOCIATE: process.env.ROLE_ASSOCIATE || 'ASSOCIATE' };

// Lista de clientes do associado logado
associateRoutes.get(
    '/api/associate/dashboard',
    checkJwt,
    checkRole([ROLES.ASSOCIATE]),
    getAssociateDashboardController.handle
);

// Processos de um cliente específico onde o associado está vinculado
associateRoutes.get(
    '/api/associate/clients/:clientId/processes',
    checkJwt,
    checkRole([ROLES.ASSOCIATE]),
    getAssociateClientProcessesController.handle
);

export { associateRoutes };
