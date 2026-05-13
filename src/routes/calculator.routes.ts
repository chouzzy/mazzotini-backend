import { Router } from 'express';
import { checkJwt } from '../middleware/auth';
import { checkRole } from '../middleware/checkRole';
import { ROLES } from '../types';

import { SetCalculationParamsController }  from '../modules/calculator/useCases/setCalculationParams/SetCalculationParamsController';
import { GetCalculationParamsController }  from '../modules/calculator/useCases/getCalculationParams/GetCalculationParamsController';
import { RunCalculationController }        from '../modules/calculator/useCases/runCalculation/RunCalculationController';
import { GetCalculationLogController }     from '../modules/calculator/useCases/getCalculationLog/GetCalculationLogController';

const calculatorRoutes = Router();

const setParams  = new SetCalculationParamsController();
const getParams  = new GetCalculationParamsController();
const runCalc    = new RunCalculationController();
const getLog     = new GetCalculationLogController();

// GET  /api/calculator/:legalOneId/params       — lê os parâmetros atuais
calculatorRoutes.get(
    '/api/calculator/:legalOneId/params',
    checkJwt,
    checkRole([ROLES.ADMIN, ROLES.OPERATOR]),
    getParams.handle,
);

// PUT  /api/calculator/:legalOneId/params       — salva/atualiza os parâmetros
calculatorRoutes.put(
    '/api/calculator/:legalOneId/params',
    checkJwt,
    checkRole([ROLES.ADMIN, ROLES.OPERATOR]),
    setParams.handle,
);

// POST /api/calculator/:legalOneId/calculate    — executa o cálculo e salva log
calculatorRoutes.post(
    '/api/calculator/:legalOneId/calculate',
    checkJwt,
    checkRole([ROLES.ADMIN, ROLES.OPERATOR]),
    runCalc.handle,
);

// GET  /api/calculator/:legalOneId/log          — histórico de cálculos
calculatorRoutes.get(
    '/api/calculator/:legalOneId/log',
    checkJwt,
    checkRole([ROLES.ADMIN, ROLES.OPERATOR]),
    getLog.handle,
);

export { calculatorRoutes };
