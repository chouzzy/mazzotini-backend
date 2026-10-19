/**
 * checkActionSecret.ts — Autenticação das chamadas feitas pela Action do Auth0
 *
 * A Action "Sincronizar Usuário com Backend Mazzotini" (fluxo post-login do Auth0)
 * chama `POST /api/users` no primeiro login de cada usuário, de fora do navegador e
 * sem o JWT de um usuário. Ela envia o header `x-auth0-secret` com o segredo
 * `AUTH0_HOOK_SECRET` configurado na própria Action; o servidor precisa ter o mesmo
 * valor em `AUTH0_HOOK_SECRET`.
 *
 * Sem a variável no servidor, toda chamada é recusada. Isso não derruba o login: a
 * Action só registra o erro no log dela, e o usuário é criado depois pelo
 * `POST /api/users/sync` do frontend (sem o papel INVESTOR no Auth0, que o
 * `checkRole` cobre lendo o papel do banco).
 *
 * ## Respostas possíveis
 * - `401` Header ausente, segredo diferente ou `AUTH0_HOOK_SECRET` não configurado
 *
 * ## Uso
 * ```typescript
 * router.post('/api/users', checkActionSecret, controller.handle);
 * ```
 */

import { createHash, timingSafeEqual } from 'crypto';
import { Request, Response, NextFunction } from 'express';

const SECRET_HEADER = 'x-auth0-secret';

/** Compara em tempo constante. O hash iguala os tamanhos, como o `timingSafeEqual` exige. */
function secretsMatch(received: string, expected: string): boolean {
    const receivedHash = createHash('sha256').update(received).digest();
    const expectedHash = createHash('sha256').update(expected).digest();
    return timingSafeEqual(receivedHash, expectedHash);
}

export const checkActionSecret = (req: Request, res: Response, next: NextFunction) => {
    // Lido a cada requisição (e não no import) para respeitar o .env carregado depois.
    const expectedSecret = process.env.AUTH0_HOOK_SECRET;

    if (!expectedSecret) {
        console.error(`[ActionSecret] AUTH0_HOOK_SECRET não configurado: ${req.method} ${req.path} recusado.`);
        return res.status(401).json({ error: 'Não autorizado.' });
    }

    const receivedSecret = req.header(SECRET_HEADER);

    if (!receivedSecret || !secretsMatch(receivedSecret, expectedSecret)) {
        console.warn(`[ActionSecret] Requisição recusada em ${req.method} ${req.path}: segredo ausente ou inválido.`);
        return res.status(401).json({ error: 'Não autorizado.' });
    }

    return next();
};
