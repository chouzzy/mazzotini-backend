// /src/middleware/checkRole.ts
// 1. Importamos Request, Response, e NextFunction diretamente do Express
import { Request, Response, NextFunction } from 'express';
// 2. Importamos apenas a tipagem do payload da biblioteca de autenticação
import { JWTPayload } from 'express-oauth2-jwt-bearer';

// 3. Mantemos a nossa interface para o payload customizado.
interface CustomJWTPayload extends JWTPayload {
  'https://mazzotini.awer.co/roles'?: string[];
}

/**
 * Middleware que verifica se o utilizador autenticado possui uma das roles permitidas.
 * @param allowedRoles Array de strings com as roles que têm acesso.
 */
export const checkRole = (allowedRoles: string[]) => {
  // 4. O parâmetro 'req' agora usa o tipo 'Request' padrão do Express.
  // A biblioteca de autenticação já adicionou a propriedade 'auth' a este tipo.
  return (req: Request, res: Response, next: NextFunction) => {
    
    // 5. Usamos a asserção de tipo para informar ao TypeScript sobre as nossas roles.
    const payload = req.auth?.payload as CustomJWTPayload;
    
    const roles = payload ? payload['https://mazzotini.awer.co/roles'] : undefined;

    if (!roles || !Array.isArray(roles)) {
      console.warn("Middleware checkRole: Nenhuma role encontrada no token JWT.");
      return res.status(403).json({ error: 'Permissões insuficientes.' });
    }

    const hasPermission = roles.some(role => allowedRoles.includes(role));

    if (!hasPermission) {
      console.warn(`Middleware checkRole: Acesso negado. Roles do utilizador [${roles}] não incluem nenhuma de [${allowedRoles}].`);
      return res.status(403).json({ error: 'Acesso negado. Você não tem a permissão necessária para este recurso.' });
    }
    
    next();
  };
};

