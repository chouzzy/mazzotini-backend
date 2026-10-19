/**
 * checkActionSecret.ts — Autenticação das chamadas feitas pela Action do Auth0
 *
 * A Action do Auth0 chama a API de fora do navegador, sem o JWT de um usuário.
 * Para que só ela consiga chamar essas rotas, a Action envia o header
 * `x-auth0-action-secret` com o mesmo valor de `AUTH0_ACTION_SECRET` do servidor.
 *
 * ## Modo de transição
 * Enquanto `AUTH0_ACTION_SECRET` não estiver definido, a requisição passa e um
 * aviso vai para o log. Assim o deploy não derruba o login caso a Action ainda
 * não envie o header. Basta definir a variável no servidor (e o header na Action)
 * para a checagem passar a valer.
 *
 * ## Respostas possíveis
 * - `401` Header ausente ou diferente do segredo configurado
 *
 * ## Uso
 * ```typescript
 * router.post('/api/users', checkActionSecret, controller.handle);
 * ```
 */

import { createHash, timingSafeEqual } from 'crypto';
import { Request, Response, NextFunction } from 'express';

const SECRET_HEADER = 'x-auth0-action-secret';

/** Compara em tempo constante. O hash iguala os tamanhos, como o `timingSafeEqual` exige. */
function secretsMatch(received: string, expected: string): boolean {
    const receivedHash = createHash('sha256').update(received).digest();
    const expectedHash = createHash('sha256').update(expected).digest();
    return timingSafeEqual(receivedHash, expectedHash);
}

export const checkActionSecret = (req: Request, res: Response, next: NextFunction) => {
    // Lido a cada requisição (e não no import) para respeitar o .env carregado depois.
    const expectedSecret = process.env.AUTH0_ACTION_SECRET;

    if (!expectedSecret) {
        console.warn(`[ActionSecret] AUTH0_ACTION_SECRET não definido: ${req.method} ${req.path} aceito sem autenticação.`);
        return next();
    }

    const receivedSecret = req.header(SECRET_HEADER);

    if (!receivedSecret || !secretsMatch(receivedSecret, expectedSecret)) {
        console.warn(`[ActionSecret] Requisição recusada em ${req.method} ${req.path}: segredo ausente ou inválido.`);
        return res.status(401).json({ error: 'Não autorizado.' });
    }

    return next();
};
