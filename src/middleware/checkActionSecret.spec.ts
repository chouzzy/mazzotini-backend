import { Request, Response } from 'express';
import { checkActionSecret } from './checkActionSecret';

// Mesmo header que a Action "Sincronizar Usuário com Backend Mazzotini" envia
const buildRequest = (secret?: string) => ({
    method: 'POST',
    path: '/api/users',
    header: (name: string) => (name === 'x-auth0-secret' ? secret : undefined),
}) as unknown as Request;

const buildResponse = () => {
    const res = { status: jest.fn(), json: jest.fn() };
    res.status.mockReturnValue(res);
    return res as unknown as Response & { status: jest.Mock; json: jest.Mock };
};

describe('checkActionSecret', () => {
    const originalSecret = process.env.AUTH0_HOOK_SECRET;

    beforeEach(() => {
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        // Atribuir `undefined` a process.env grava a string "undefined"; por isso o delete.
        if (originalSecret === undefined) delete process.env.AUTH0_HOOK_SECRET;
        else process.env.AUTH0_HOOK_SECRET = originalSecret;
        jest.restoreAllMocks();
    });

    it('recusa com 401 quando AUTH0_HOOK_SECRET não está configurado no servidor', () => {
        delete process.env.AUTH0_HOOK_SECRET;
        const res = buildResponse();
        const next = jest.fn();

        checkActionSecret(buildRequest('qualquer-coisa'), res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    it('recusa com 401 quando o header não vem', () => {
        process.env.AUTH0_HOOK_SECRET = 'segredo-da-action';
        const res = buildResponse();
        const next = jest.fn();

        checkActionSecret(buildRequest(), res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    it('recusa com 401 quando o segredo é diferente', () => {
        process.env.AUTH0_HOOK_SECRET = 'segredo-da-action';
        const res = buildResponse();
        const next = jest.fn();

        checkActionSecret(buildRequest('outro-segredo'), res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    it('deixa passar quando o segredo confere', () => {
        process.env.AUTH0_HOOK_SECRET = 'segredo-da-action';
        const res = buildResponse();
        const next = jest.fn();

        checkActionSecret(buildRequest('segredo-da-action'), res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });
});
