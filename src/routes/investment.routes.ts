/**
 * investment.routes.ts — Rotas de Investimentos
 *
 * Cobre a consulta da carteira do usuário autenticado.
 * Clientes veem seus próprios investimentos; admins e operadores veem todos
 * (controlado no use case via role do token).
 */

import { Router } from 'express';
import { checkJwt } from '../middleware/auth';
import { ListMyInvestmentsController } from '../modules/investments/useCases/listMyInvestments/ListMyInvestmentsController';
import { UpdateInvestmentAssociateController } from '../modules/investments/useCases/updateInvestmentAssociate/UpdateInvestmentAssociateController';

const investmentRoutes = Router();
const listMyInvestmentsController = new ListMyInvestmentsController();
const updateInvestmentAssociateController = new UpdateInvestmentAssociateController();


/**
 * @swagger
 * /api/investments/me:
 *   get:
 *     summary: Retorna os investimentos do usuário autenticado
 *     description: |
 *       Lista todos os ativos em que o usuário possui participação (investorShare > 0).
 *       Para cada investimento, retorna o ativo vinculado com valor atualizado, participação
 *       e documentos contratuais.
 *     tags: [Investimentos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de investimentos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   investorShare:
 *                     type: number
 *                     example: 30
 *                     description: "Percentual do cliente (%)"
 *                   mazzotiniShare:
 *                     type: number
 *                     example: 5
 *                     description: "Percentual da Mazzotini (%)"
 *                   acquisitionDate:
 *                     type: string
 *                     format: date-time
 *                     nullable: true
 *                   asset:
 *                     $ref: '#/components/schemas/CreditAssetSummary'
 *       401:
 *         description: Token inválido ou expirado
 */
investmentRoutes.get(
    '/api/investments/me',
    checkJwt,
    listMyInvestmentsController.handle
);

// Cliente vincula ou remove o associado de um investimento seu
investmentRoutes.patch(
    '/api/investments/:investmentId/associate',
    checkJwt,
    updateInvestmentAssociateController.handle
);

export { investmentRoutes };
