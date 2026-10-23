import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { UpdateMyProfileUseCase } from './UpdateMyProfileUseCase';
import { UpdateMyProfileController } from './UpdateMyProfileController';

jest.mock('@prisma/client', () => {
    const mPrisma: any = { user: { findUnique: jest.fn(), update: jest.fn() } };
    return { PrismaClient: jest.fn(() => mPrisma) };
});

jest.mock('../../../../services/notificationService', () => ({ notifyAllAdmins: jest.fn() }));

const prisma = new PrismaClient() as any;

// Ids fictícios no formato do Mongo
const CLIENT_ID    = '64b7f0c2a1b2c3d4e5f60701';
const ASSOCIATE_ID = '64b7f0c2a1b2c3d4e5f60702';
const OTHER_ID     = '64b7f0c2a1b2c3d4e5f60703';

/** Banco simulado: o cliente (pelo auth0UserId) e os outros usuários (pelo id). */
let me: Record<string, any>;
const others: Record<string, any> = {
    [ASSOCIATE_ID]: { role: 'ASSOCIATE' },
    [OTHER_ID]:     { role: 'INVESTOR' },
};

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    me = { id: CLIENT_ID, status: 'ACTIVE', cpfOrCnpj: '00000000191', referredById: null };
    prisma.user.findUnique.mockImplementation(({ where }: any) =>
        Promise.resolve(where.auth0UserId ? me : others[where.id] ?? null));
    prisma.user.update.mockResolvedValue({ id: CLIENT_ID, name: 'Cliente Exemplo' });
});

const run = (data: Record<string, unknown>) => new UpdateMyProfileUseCase().execute({ auth0UserId: 'auth0|cliente', data: data as any });
const savedData = () => prisma.user.update.mock.calls[0][0].data;

describe('UpdateMyProfileUseCase', () => {
    describe('CPF/CNPJ', () => {
        it('o cliente aprovado não troca o próprio CPF', async () => {
            await expect(run({ cpfOrCnpj: '11144477735' })).rejects.toMatchObject({
                statusCode: 400, message: 'O CPF/CNPJ só pode ser alterado pelo escritório. Fale com o suporte.',
            });
            expect(prisma.user.update).not.toHaveBeenCalled();
        });

        it('o mesmo CPF com máscara passa', async () => {
            await run({ cpfOrCnpj: '000.000.001-91', name: 'Cliente Exemplo' });

            expect(savedData()).toMatchObject({ name: 'Cliente Exemplo' });
        });

        it('o cliente aprovado sem CPF gravado pode preencher', async () => {
            me.cpfOrCnpj = null;

            await run({ cpfOrCnpj: '11144477735' });

            expect(savedData()).toMatchObject({ cpfOrCnpj: '11144477735' });
        });

        it('no onboarding, o CPF é livre', async () => {
            me.status = 'PENDING_ONBOARDING';

            await run({ cpfOrCnpj: '11144477735' });

            expect(savedData()).toMatchObject({ cpfOrCnpj: '11144477735', status: 'PENDING_REVIEW' });
        });
    });

    describe('indicação', () => {
        it('aceita um associado', async () => {
            await run({ referredById: ASSOCIATE_ID });

            expect(savedData()).toMatchObject({ referredById: ASSOCIATE_ID });
        });

        it.each([
            ['um usuário que não é associado', OTHER_ID, 'O usuário indicado não é um associado.'],
            ['um id fora do formato', 'nao-e-id', 'O usuário indicado não é um associado.'],
            ['o próprio cliente', CLIENT_ID, 'O cliente não pode ser indicado por ele mesmo.'],
        ])('recusa %s', async (_, referredById, message) => {
            await expect(run({ referredById })).rejects.toMatchObject({ statusCode: 400, message });
            expect(prisma.user.update).not.toHaveBeenCalled();
        });

        it('a indicação que já estava gravada passa como está', async () => {
            me.referredById = OTHER_ID;

            await run({ referredById: OTHER_ID });

            expect(savedData()).toMatchObject({ referredById: OTHER_ID });
        });
    });

    it('grava o consentimento com a hora do servidor', async () => {
        me.status = 'PENDING_ONBOARDING';
        const before = Date.now();

        await run({ consentedToTermsAt: new Date('2000-01-01'), consentedToPrivacyAt: new Date('2000-01-01'), termsVersion: '1.0' });

        const data = savedData();
        expect(data.consentedToTermsAt.getTime()).toBeGreaterThanOrEqual(before);
        expect(data.consentedToPrivacyAt.getTime()).toBeGreaterThanOrEqual(before);
        expect(data.termsVersion).toBe('1.0');
    });

    it.each([
        ['outra versão', '2.0'],
        ['null', null],
    ])('sem o aceite, a versão do termo não é gravada (%s)', async (_, termsVersion) => {
        await run({ name: 'Cliente Exemplo', termsVersion });

        expect(savedData()).not.toHaveProperty('termsVersion');
    });
});

describe('UpdateMyProfileController', () => {
    /** Corpo mínimo que passa na validação, com dados fictícios. */
    const body = {
        name: 'Cliente Exemplo', cpfOrCnpj: '00000000191', cellPhone: '11900000000',
        residentialCep: '01000000', residentialStreet: 'Rua Exemplo', residentialNumber: '1',
        residentialNeighborhood: 'Centro', residentialCity: 'São Paulo', residentialState: 'SP',
    };
    const handle = async (extra: Record<string, unknown>) => {
        const req = { auth: { payload: { sub: 'auth0|cliente' } }, body: { ...body, ...extra } } as unknown as Request;
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn(), send: jest.fn() } as unknown as Response;
        await new UpdateMyProfileController().handle(req, res);
        return res as any;
    };

    it('o telefone fixo chega ao banco', async () => {
        const res = await handle({ phone: '1130000000' });

        expect(res.status).toHaveBeenCalledWith(204);
        expect(savedData()).toMatchObject({ phone: '1130000000' });
    });

    it('o consentimento do onboarding chega ao banco', async () => {
        me.status = 'PENDING_ONBOARDING';

        await handle({ consentedToTermsAt: '2026-10-23T12:00:00.000Z', consentedToPrivacyAt: '2026-10-23T12:00:00.000Z', termsVersion: '1.0' });

        expect(savedData()).toMatchObject({ termsVersion: '1.0' });
        expect(savedData().consentedToTermsAt).toBeInstanceOf(Date);
        expect(savedData().consentedToPrivacyAt).toBeInstanceOf(Date);
    });

    it('falha do banco ao conferir a indicação responde 500, sem a mensagem técnica', async () => {
        prisma.user.findUnique.mockImplementation(({ where }: any) =>
            where.auth0UserId ? Promise.resolve(me) : Promise.reject(new Error('Server selection timeout')));

        const res = await handle({ referredById: ASSOCIATE_ID });

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Erro interno ao atualizar o perfil.' });
    });

    it('a recusa do CPF responde 400 com a mensagem', async () => {
        const res = await handle({ cpfOrCnpj: '11144477735' });

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'O CPF/CNPJ só pode ser alterado pelo escritório. Fale com o suporte.' });
    });
});
