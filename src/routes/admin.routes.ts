import { Router } from 'express';
import { checkJwt } from '../middleware/auth';
import { checkRole } from '../middleware/checkRole';
import { ROLES } from '../types';
import { RunHealthCheckController, GetHealthLogsController } from '../modules/admin/useCases/healthCheck/HealthCheckController';

const adminRoutes = Router();

const runHealthCheck = new RunHealthCheckController();
const getHealthLogs = new GetHealthLogsController();

adminRoutes.post('/api/admin/health-check', checkJwt, checkRole([ROLES.ADMIN]), runHealthCheck.handle);
adminRoutes.get('/api/admin/health-logs', checkJwt, checkRole([ROLES.ADMIN]), getHealthLogs.handle);

export { adminRoutes };
