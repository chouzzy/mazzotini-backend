import { Router } from 'express';
import { checkJwt } from '../middleware/auth';
import { checkRole } from '../middleware/checkRole';
import { ROLES } from '../types';
import { RunHealthCheckController, GetHealthLogsController } from '../modules/admin/useCases/healthCheck/HealthCheckController';
import { SystemSettingsController } from '../modules/admin/useCases/systemSettings/SystemSettingsController';

const adminRoutes = Router();

const runHealthCheck = new RunHealthCheckController();
const getHealthLogs = new GetHealthLogsController();
const systemSettings = new SystemSettingsController();

adminRoutes.post('/api/admin/health-check', checkJwt, checkRole([ROLES.ADMIN]), runHealthCheck.handle);
adminRoutes.get('/api/admin/health-logs', checkJwt, checkRole([ROLES.ADMIN]), getHealthLogs.handle);
adminRoutes.get('/api/admin/settings', checkJwt, checkRole([ROLES.ADMIN]), systemSettings.get);
adminRoutes.patch('/api/admin/settings', checkJwt, checkRole([ROLES.ADMIN]), systemSettings.update);

export { adminRoutes };
