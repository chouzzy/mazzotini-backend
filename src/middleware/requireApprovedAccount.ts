/**
 * requireApprovedAccount.ts — Barreira das rotas com dados de cliente
 *
 * Processos, valores e documentos do cliente só para conta aprovada (status ACTIVE, ou nulo, de
 * cadastro antigo). A tela já mostra às outras só o onboarding ou a espera da aprovação, mas a API
 * não conferia: uma conta ainda não aprovada e já ligada a processos (pela importação ou pela
 * carteira montada pelo admin) recebia os dados com o próprio token.
 *
 * Admin e operador passam sem a checagem. O papel vem do token ou, sem ele, do banco, como no
 * checkRole. Sem cadastro no banco, a requisição segue, e o use case responde como sempre.
 *
 * Deve vir depois do `checkJwt` (e do `checkRole`, quando a rota tiver).
 *
 * ## Respostas
 * - `401` token sem `sub`
 * - `403` `{ error, code: 'ACCOUNT_NOT_APPROVED' }` para a conta ainda não aprovada
 * - `500` falha ao consultar o banco
 */

import { NextFunction, Request, Response } from 'express';
import { prisma } from '../prisma';
import { ROLES } from '../types';
import { isApprovedAccount } from '../utils/accountStatus';

const ROLES_CLAIM    = 'https://mazzotini.awer.co/roles';
const INTERNAL_ROLES = [ROLES.ADMIN, ROLES.OPERATOR];

export const requireApprovedAccount = async (req: Request, res: Response, next: NextFunction) => {
    const payload = (req as any).auth?.payload;
    const auth0UserId: string | undefined = payload?.sub;
    if (!auth0UserId) return res.status(401).json({ error: 'Não autorizado. Token inválido.' });

    const tokenRoles: string[] = payload[ROLES_CLAIM] || [];
    if (tokenRoles.some(role => INTERNAL_ROLES.includes(role))) return next();

    try {
        const user = await prisma.user.findUnique({
            where:  { auth0UserId },
            select: { role: true, status: true },
        });
        if (!user) return next();
        if (tokenRoles.length === 0 && user.role && INTERNAL_ROLES.includes(user.role)) return next();
        if (isApprovedAccount(user.status)) return next();

        return res.status(403).json({
            error: 'Seu cadastro ainda não foi aprovado. Os processos e documentos aparecem depois da aprovação.',
            code:  'ACCOUNT_NOT_APPROVED',
        });
    } catch (error) {
        console.error('[RequireApprovedAccount] Falha ao consultar o cadastro:', error);
        return res.status(500).json({ error: 'Erro interno ao verificar o cadastro.' });
    }
};
