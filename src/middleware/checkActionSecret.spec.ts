import { Request, Response } from 'express';
import { checkActionSecret } from './checkActionSecret';

const buildRequest = (secret?: string) => ({
    method: 'POST',
    path: '/api/users',
    header: (name: string) => (name === 'x-auth0-action-secret' ? secret : undefined),
}) as unknown as Request;

const buildResponse = () => {
    const res = { status: jest.fn(), json: jest.fn() };
    res.status.mockReturnValue(res);
    return res as unknown as Response & { status: jest.Mock; json: jest.Mock };
};

describe('checkActionSecret', () => {
    const originalSecret = process.env.AUTH0_ACTION_SECRET;

    beforeEach(() => {
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        // Atribuir `undefined` a process.env grava a string "undefined"; por isso o delete.
        if (originalSecret === undefined) delete process.env.AUTH0_ACTION_SECRET;
        else process.env.AUTH0_ACTION_SECRET = originalSecret;
        jest.restoreAllMocks();
    });

    it('deixa passar (modo de transição) enquanto AUTH0_ACTION_SECRET não estiver definido', () => {
        delete process.env.AUTH0_ACTION_SECRET;
        const res = buildResponse();
        const next = jest.fn();

        checkActionSecret(buildRequest(), res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('recusa com 401 quando o header não vem', () => {
        process.env.AUTH0_ACTION_SECRET = 'segredo-da-action';
        const res = buildResponse();
        const next = jest.fn();

        checkActionSecret(buildRequest(), res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    it('recusa com 401 quando o segredo é diferente', () => {
        process.env.AUTH0_ACTION_SECRET = 'segredo-da-action';
        const res = buildResponse();
        const next = jest.fn();

        checkActionSecret(buildRequest('outro-segredo'), res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    it('deixa passar quando o segredo confere', () => {
        process.env.AUTH0_ACTION_SECRET = 'segredo-da-action';
        const res = buildResponse();
        const next = jest.fn();

        checkActionSecret(buildRequest('segredo-da-action'), res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });
});
