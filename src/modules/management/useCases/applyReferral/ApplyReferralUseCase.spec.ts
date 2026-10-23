import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ApplyReferralUseCase } from './ApplyReferralUseCase';
import { ApplyReferralController } from './ApplyReferralController';

jest.mock('@prisma/client', () => {
    const mPrisma: any = {
        user: { findUnique: jest.fn() },
        investment: { updateMany: jest.fn() },
    };
    return { PrismaClient: jest.fn(() => mPrisma) };
});

const prisma = new PrismaClient() as any;

/** Banco simulado com dados fictícios: o cliente, um associado e um usuário que não é associado. */
let users: Record<string, any>;

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    users = {
        'cliente-1':   { id: 'cliente-1', referredById: 'associado-1' },
        'associado-1': { role: 'ASSOCIATE' },
        'cliente-2':   { role: 'INVESTOR' },
    };
    prisma.user.findUnique.mockImplementation(({ where }: any) => Promise.resolve(users[where.id] ?? null));
    prisma.investment.updateMany.mockResolvedValue({ count: 2 });
});

describe('ApplyReferralUseCase', () => {
    it('leva a indicação gravada para os processos que a tela mostrou', async () => {
        const result = await new ApplyReferralUseCase().execute('cliente-1', ['inv-1', 'inv-2']);

        expect(prisma.investment.updateMany).toHaveBeenCalledWith({
            where: { userId: 'cliente-1', id: { in: ['inv-1', 'inv-2'] } },
            data:  { associateId: 'associado-1' },
        });
        expect(result).toEqual({ investmentsUpdated: 2 });
    });

    it('sem a lista, leva para todos os processos do cliente', async () => {
        await new ApplyReferralUseCase().execute('cliente-1');

        expect(prisma.investment.updateMany).toHaveBeenCalledWith({ where: { userId: 'cliente-1' }, data: { associateId: 'associado-1' } });
    });

    it.each([
        ['o cliente não existe', 'inexistente', undefined, 'Usuário não encontrado.'],
        ['a indicação é um nome manual (sem associado cadastrado)', 'cliente-1', null, 'Escolha um associado cadastrado para levar aos processos do cliente.'],
        ['a indicação não é um associado', 'cliente-1', 'cliente-2', 'O usuário indicado não é um associado.'],
    ])('recusa quando %s', async (_, userId, referredById, message) => {
        if (referredById !== undefined) users['cliente-1'] = { id: 'cliente-1', referredById };

        await expect(new ApplyReferralUseCase().execute(userId)).rejects.toThrow(message);
        expect(prisma.investment.updateMany).not.toHaveBeenCalled();
    });
});

describe('ApplyReferralController', () => {
    const run = async (body: unknown) => {
        const req = { params: { id: 'cliente-1' }, body } as unknown as Request;
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
        await new ApplyReferralController().handle(req, res);
        return res as any;
    };

    it('responde quantos processos mudaram', async () => {
        const res = await run({ investmentIds: ['64b7f0c2a1b2c3d4e5f60718'] });

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ investmentsUpdated: 2 });
    });

    it('recusa um processo com id inválido, sem gravar nada', async () => {
        const res = await run({ investmentIds: ['não-é-id'] });

        expect(res.status).toHaveBeenCalledWith(400);
        expect(prisma.investment.updateMany).not.toHaveBeenCalled();
    });

    it('devolve o motivo da recusa', async () => {
        users['cliente-1'] = { id: 'cliente-1', referredById: null };

        const res = await run({});

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Escolha um associado cadastrado para levar aos processos do cliente.' });
    });
});
