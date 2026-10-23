import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { GetAssociateClientProcessesUseCase } from './GetAssociateClientProcessesUseCase';
import { GetAssociateClientProcessesController } from './GetAssociateClientProcessesController';

jest.mock('@prisma/client', () => {
    const mPrisma: any = {
        user: { findUnique: jest.fn() },
        investment: { count: jest.fn(), findMany: jest.fn() },
    };
    return { PrismaClient: jest.fn(() => mPrisma) };
});

const prisma = new PrismaClient() as any;

// Ids fictícios no formato do Mongo
const CLIENT_ID = '64b7f0c2a1b2c3d4e5f60718';
const OTHER_ID  = '64b7f0c2a1b2c3d4e5f60719';

beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockImplementation(({ where }: any) => Promise.resolve(
        where.auth0UserId === 'auth0|associado' ? { id: 'associado-1' }
        : where.id === CLIENT_ID ? { id: CLIENT_ID, name: 'Cliente Exemplo', email: 'cliente@exemplo.com', profilePictureUrl: null }
        // Outro usuário que existe, mas não tem processo com o associado
        : where.id === OTHER_ID ? { id: OTHER_ID, name: 'Outro Cliente', email: 'outro@exemplo.com', profilePictureUrl: null }
        : null,
    ));
    // O CLIENT_ID tem processo com o associado; o OTHER_ID também tem processo, mas com outro
    // associado. O filtro que a consulta não mandar fica aberto, para um filtro esquecido no use
    // case aparecer no teste
    const investments = [
        { userId: CLIENT_ID, associateId: 'associado-1' },
        { userId: OTHER_ID,  associateId: 'associado-2' },
    ];
    prisma.investment.count.mockImplementation(({ where }: any) => Promise.resolve(investments.filter(inv =>
        (where.userId === undefined || inv.userId === where.userId)
        && (where.associateId === undefined || inv.associateId === where.associateId)).length));
    prisma.investment.findMany.mockResolvedValue([]);
});

describe('GetAssociateClientProcessesUseCase', () => {
    it('mostra o cliente que o associado acompanha, só com processos já sincronizados', async () => {
        const result = await new GetAssociateClientProcessesUseCase().execute('auth0|associado', CLIENT_ID);

        expect(result.client).toMatchObject({ id: CLIENT_ID, name: 'Cliente Exemplo' });
        expect(prisma.investment.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                associateId: 'associado-1',
                userId: CLIENT_ID,
                asset: { status: { notIn: ['FAILED_ENRICHMENT', 'PENDING_ENRICHMENT'] } },
            },
        }));
    });

    it('recusa um usuário que o associado não acompanha, sem buscar os dados dele', async () => {
        await expect(new GetAssociateClientProcessesUseCase().execute('auth0|associado', OTHER_ID))
            .rejects.toMatchObject({ message: 'Cliente não encontrado.', statusCode: 404 });
        expect(prisma.user.findUnique).not.toHaveBeenCalledWith(expect.objectContaining({ where: { id: OTHER_ID } }));
        expect(prisma.investment.findMany).not.toHaveBeenCalled();
    });

    it('recusa um id fora do formato sem consultar o banco', async () => {
        await expect(new GetAssociateClientProcessesUseCase().execute('auth0|associado', 'nao-e-id'))
            .rejects.toMatchObject({ statusCode: 404 });
        expect(prisma.investment.count).not.toHaveBeenCalled();
    });
});

describe('GetAssociateClientProcessesController', () => {
    it('responde 404 para o cliente que não é do associado', async () => {
        const req = { auth: { payload: { sub: 'auth0|associado' } }, params: { clientId: OTHER_ID } } as unknown as Request;
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;

        await new GetAssociateClientProcessesController().handle(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ error: 'Cliente não encontrado.' });
    });
});
