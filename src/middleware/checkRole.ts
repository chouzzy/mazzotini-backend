import { Request, Response, NextFunction } from 'express';
import { JWTPayload } from 'express-oauth2-jwt-bearer';

// Interface estendida para incluir as roles do Auth0 no payload
interface CustomJWTPayload extends JWTPayload {
  'https://mazzotini.awer.co/roles'?: string[];
}

/**
 * Middleware que verifica se o utilizador autenticado possui uma das roles permitidas.
 * @param allowedRoles Array de strings com as roles que têm acesso.
 */
export const checkRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    
    // O 'req.auth' é injetado pelo middleware 'checkJwt' que roda antes deste
    const payload = (req as any).auth?.payload as CustomJWTPayload;

    const roles = payload ? payload['https://mazzotini.awer.co/roles'] : undefined;

    if (!roles || !Array.isArray(roles)) {
      console.warn("[CheckRole] Nenhuma role encontrada no token JWT. Verifique a Action do Auth0.");
      return res.status(403).json({ error: 'Permissões insuficientes. (Sem roles)' });
    }

    const hasPermission = roles.some(role => allowedRoles.includes(role));

    if (!hasPermission) {
      console.warn(`[CheckRole] Acesso negado. User Roles: [${roles}] | Necessário: [${allowedRoles}]`);
      return res.status(403).json({ error: 'Acesso negado. Você não tem permissão para este recurso.' });
    }
    
    next();
  };
};