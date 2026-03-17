import { Request, Response, NextFunction } from 'express';
import { JWTPayload } from 'express-oauth2-jwt-bearer';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Interface estendida para incluir as roles do Auth0 no payload
interface CustomJWTPayload extends JWTPayload {
  'https://mazzotini.awer.co/roles'?: string[];
}

/**
 * Middleware que verifica se o utilizador autenticado possui uma das roles permitidas.
 * Faz uma verificação dupla: primeiro no token Auth0, e se falhar, verifica no banco de dados.
 * @param allowedRoles Array de strings com as roles que têm acesso.
 */
export const checkRole = (allowedRoles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    
    const payload = (req as any).auth?.payload as CustomJWTPayload;
    const auth0UserId = payload?.sub;

    if (!auth0UserId) {
        return res.status(401).json({ error: 'Não autorizado. Token inválido.' });
    }

    // 1. TENTA LER DO TOKEN (Mais Rápido)
    let roles = payload['https://mazzotini.awer.co/roles'] || [];

    // 2. SE O TOKEN ESTIVER VAZIO, VAI AO BANCO DE DADOS (Fallback Seguro)
    if (!roles || roles.length === 0) {
        console.warn(`[CheckRole] Token de ${auth0UserId} veio sem roles. Consultando o banco de dados...`);
        
        try {
            const userInDb = await prisma.user.findUnique({
                where: { auth0UserId },
                select: { role: true }
            });

            if (userInDb && userInDb.role) {
                roles = [userInDb.role];
                // Injeta no request para os próximos controllers não precisarem buscar de novo
                payload['https://mazzotini.awer.co/roles'] = roles; 
                console.log(`[CheckRole] Role '${userInDb.role}' resgatada do banco com sucesso.`);
            }
        } catch (error) {
            console.error("[CheckRole] Erro ao buscar role no banco:", error);
        }
    }

    // 3. VALIDAÇÃO FINAL
    if (!roles || roles.length === 0) {
      console.warn(`[CheckRole] Bloqueio Definitivo: Usuário ${auth0UserId} não tem roles no Token nem no Banco.`);
      return res.status(403).json({ error: 'Permissões insuficientes. Nenhuma role atribuída.' });
    }

    const hasPermission = roles.some(role => allowedRoles.includes(role));

    if (!hasPermission) {
      console.warn(`[CheckRole] Acesso negado. User Roles: [${roles}] | Necessário: [${allowedRoles}]`);
      return res.status(403).json({ error: 'Acesso negado. Você não tem permissão para este recurso.' });
    }
    
    next();
  };
};