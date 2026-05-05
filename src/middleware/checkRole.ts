/**
 * checkRole.ts — Middleware de Autorização por Role (RBAC)
 *
 * Garante que o usuário autenticado possui uma das roles necessárias para acessar
 * um endpoint. Deve ser usado APÓS o `checkJwt`.
 *
 * ## Estratégia Dupla (Token → Banco de dados)
 *
 * ### 1ª tentativa: lê as roles do token JWT
 * As roles ficam no campo customizado `https://mazzotini.awer.co/roles` do payload.
 * Isso é o caminho rápido — sem consulta ao banco, apenas decodificação do JWT.
 *
 * ### 2ª tentativa (fallback): consulta o banco de dados
 * Se o token vier sem roles (situação comum no plano gratuito do Auth0, onde as
 * Actions que injetam roles têm limite de execução), o middleware busca a role
 * diretamente no banco de dados usando o `auth0UserId` do token.
 *
 * Essa é uma solução intencional para contornar o rate limit do Auth0 Free Tier.
 * Quando o plano for atualizado, o fallback pode ser removido.
 *
 * ## Respostas possíveis
 * - `401` Token inválido ou sem `sub` (não deve ocorrer se `checkJwt` passou)
 * - `403` Usuário sem roles ou com role diferente das permitidas
 * - `500` Falha ao consultar o banco no fallback
 *
 * ## Uso
 * ```typescript
 * router.get('/rota', checkJwt, checkRole(['ADMIN', 'OPERATOR']), controller.handle);
 * ```
 */

import { prisma } from '../prisma';
import { Request, Response, NextFunction } from 'express';
import { JWTPayload } from 'express-oauth2-jwt-bearer';


/** Extensão do payload JWT para incluir as roles customizadas do Auth0 */
interface CustomJWTPayload extends JWTPayload {
    'https://mazzotini.awer.co/roles'?: string[];
}

/**
 * Factory que retorna o middleware de autorização configurado com as roles permitidas.
 * @param allowedRoles - Lista de roles que têm permissão para acessar o endpoint.
 */
export const checkRole = (allowedRoles: string[]) => {
    return async (req: Request, res: Response, next: NextFunction) => {

        const payload = (req as any).auth?.payload as CustomJWTPayload;
        const auth0UserId = payload?.sub;

        if (!auth0UserId) {
            return res.status(401).json({ error: 'Não autorizado. Token inválido.' });
        }

        // ── 1ª Tentativa: roles do token JWT ──────────────────────────────────
        let roles = payload['https://mazzotini.awer.co/roles'] || [];

        // ── 2ª Tentativa: fallback para o banco (Auth0 Free Plan) ─────────────
        if (!roles || roles.length === 0) {
            console.warn(`[CheckRole] Token de ${auth0UserId} veio sem roles. Consultando o banco de dados...`);

            try {
                const userInDb = await prisma.user.findUnique({
                    where: { auth0UserId },
                    select: { role: true },
                });

                if (userInDb?.role) {
                    roles = [userInDb.role];

                    // Injeta no payload para que controllers subsequentes não precisem buscar novamente
                    payload['https://mazzotini.awer.co/roles'] = roles;
                    console.log(`[CheckRole] Role '${userInDb.role}' resgatada do banco com sucesso.`);
                }
            } catch (error) {
                console.error('[CheckRole] Falha ao consultar banco de dados para role:', error);
                return res.status(500).json({ error: 'Erro interno ao verificar permissões.' });
            }
        }

        // ── Validação final ───────────────────────────────────────────────────
        if (!roles || roles.length === 0) {
            console.warn(`[CheckRole] Bloqueio: usuário ${auth0UserId} não tem roles no token nem no banco.`);
            return res.status(403).json({ error: 'Permissões insuficientes. Nenhuma role atribuída.' });
        }

        const hasPermission = roles.some(role => allowedRoles.includes(role));

        if (!hasPermission) {
            console.warn(`[CheckRole] Acesso negado. Roles do usuário: [${roles}] | Necessário: [${allowedRoles}]`);
            return res.status(403).json({ error: 'Acesso negado. Você não tem permissão para este recurso.' });
        }

        next();
    };
};
