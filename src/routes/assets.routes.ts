import { Router } from 'express';
import { UpdateAssetStrategyController } from '../modules/assets/useCases/updateAssetStrategy/UpdateAssetStrategyController';
import { checkRole } from '../middleware/checkRole';
import { checkJwt } from '../middleware/auth';

const assetsRoutes = Router();

const updateAssetStrategyController = new UpdateAssetStrategyController();


assetsRoutes.patch(
    '/api/assets/:id/strategy',
    checkJwt,
    checkRole(['ADMIN', 'OPERATOR']), 
    updateAssetStrategyController.handle
);


export { assetsRoutes };
