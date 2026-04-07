/**
 * auth.ts — Middleware de Autenticação JWT
 *
 * Usa a biblioteca `express-oauth2-jwt-bearer` para validar tokens JWT
 * emitidos pelo Auth0. O token é verificado contra:
 *  - `audience`: identifica para qual API o token foi emitido
 *  - `issuerBaseURL`: garante que o token veio do tenant Auth0 correto
 *  - `tokenSigningAlg`: algoritmo RS256 (chave assimétrica, mais seguro que HS256)
 *
 * Se o token for inválido, expirado ou ausente, o middleware retorna 401 automaticamente.
 *
 * Uso:
 *   router.get('/rota-protegida', checkJwt, meuController.handle);
 *
 * As variáveis de ambiente devem estar definidas no .env do servidor:
 *   AUTH0_AUDIENCE=https://mazzotini.api
 *   AUTH0_DOMAIN=dev-xxxxx.us.auth0.com
 */

import { auth } from 'express-oauth2-jwt-bearer';

const checkJwt = auth({
    audience: process.env.AUTH0_AUDIENCE as string,
    issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}/`,
    tokenSigningAlg: 'RS256',
});

export { checkJwt };
