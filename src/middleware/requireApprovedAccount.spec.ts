import { NextFunction, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireApprovedAccount } from './requireApprovedAccount';

jest.mock('@prisma/client', () => {
    const mPrisma: any = { user: { findUnique: jest.fn() } };
    return { PrismaClient: jest.fn(() => mPrisma) };
});

const prisma = new PrismaClient() as any;

/** Cadastros fictícios, pelo auth0UserId. */
const users: Record<string, { role: string; status: string | null }> = {
    'auth0|aprovado':  { role: 'INVESTOR',  status: 'ACTIVE' },
    'auth0|antigo':    { role: 'INVESTOR',  status: null },
    'auth0|analise':   { role: 'INVESTOR',  status: 'PENDING_REVIEW' },
    'auth0|novo':      { role: 'INVESTOR',  status: 'PENDING_ONBOARDING' },
    'auth0|associado': { role: 'ASSOCIATE', status: 'PENDING_REVIEW' },
    'auth0|operador':  { role: 'OPERATOR',  status: 'PENDING_ONBOARDING' },
};

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    prisma.user.findUnique.mockImplementation(({ where }: any) => Promise.resolve(users[where.auth0UserId] ?? null));
});

const run = async (sub: string | undefined, roles?: string[]) => {
    const req  = { auth: { payload: { sub, ...(roles ? { 'https://mazzotini.awer.co/roles': roles } : {}) } } } as unknown as Request;
    const res  = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
    const next = jest.fn() as NextFunction;
    await requireApprovedAccount(req, res, next);
    return { res: res as any, next: next as jest.Mock };
};

describe('requireApprovedAccount', () => {
    it.each([
        ['conta aprovada', 'auth0|aprovado', undefined],
        ['cadastro antigo, sem status', 'auth0|antigo', undefined],
        ['admin pelo token, mesmo sem aprovação', 'auth0|analise', ['ADMIN']],
        ['operador pelo banco (token sem papéis)', 'auth0|operador', undefined],
        ['sem cadastro no banco (o use case responde)', 'auth0|desconhecido', undefined],
    ])('deixa passar: %s', async (_, sub, roles) => {
        const { res, next } = await run(sub, roles);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    it.each([
        ['cliente em análise', 'auth0|analise', undefined],
        ['cliente no onboarding', 'auth0|novo', ['INVESTOR']],
        ['associado ainda não aprovado', 'auth0|associado', ['ASSOCIATE']],
        // O papel vem do token quando ele tem papéis, como no checkRole
        ['operador no banco com token só de cliente', 'auth0|operador', ['INVESTOR']],
    ])('recusa com 403: %s', async (_, sub, roles) => {
        const { res, next } = await run(sub, roles);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'ACCOUNT_NOT_APPROVED' }));
    });

    it('admin pelo token não consulta o banco', async () => {
        await run('auth0|aprovado', ['ADMIN']);

        expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('sem sub no token responde 401', async () => {
        const { res, next } = await run(undefined);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
    });

    it('falha do banco responde 500, sem deixar passar', async () => {
        prisma.user.findUnique.mockRejectedValue(new Error('banco fora do ar'));

        const { res, next } = await run('auth0|aprovado');

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(500);
    });
});
