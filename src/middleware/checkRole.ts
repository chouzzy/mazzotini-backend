// // src/middleware/checkRole.ts
// import { Request, Response, NextFunction } from 'express';

// // Definimos uma interface para estender o objeto Request do Express
// // e ter acesso ao payload do token com tipagem.
// interface RequestWithAuth extends Request {
//   auth?: {
//     payload: {
//       // Assumimos que as roles estarão em uma claim customizada no token.
//       // Esta é a melhor prática com Auth0.
//       'https://mazzotini.awer.co/roles'?: string[];
//     };
//   };
// }

// /**
//  * Middleware que verifica se o usuário autenticado possui uma das roles permitidas.
//  * @param allowedRoles Array de strings com as roles que têm acesso.
//  */
// export const checkRole = (allowedRoles: string[]) => {
//   return (req: RequestWithAuth, res: Response, next: NextFunction) => {
//     // Pega as roles do payload do token JWT.
//     const roles = req.auth?.payload['https://mazzotini.awer.co/roles'];

//     if (!roles || !Array.isArray(roles)) {
//       return res.status(403).json({ error: 'Permissões insuficientes (roles não encontradas no token).' });
//     }

//     // Verifica se pelo menos uma das roles do usuário está na lista de roles permitidas.
//     const hasPermission = roles.some(role => allowedRoles.includes(role));

//     if (!hasPermission) {
//       return res.status(403).json({ error: 'Acesso negado. Você não tem a permissão necessária para este recurso.' });
//     }
    
//     // Se tiver permissão, continua para o próximo middleware ou controller.
//     next();
//   };
// };