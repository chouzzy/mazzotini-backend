import { AdminUpdateUserUseCase } from './AdminUpdateUserUseCase';
import { PrismaClient } from '@prisma/client';

jest.mock('@prisma/client', () => {
    const mPrisma: any = {
        user: { findUnique: jest.fn(), update: jest.fn() },
        userProfileChangeRequest: { updateMany: jest.fn() },
        investment: { updateMany: jest.fn() },
    };
    mPrisma.$transaction = jest.fn((fn: (tx: any) => unknown) => fn(mPrisma));
    return { PrismaClient: jest.fn(() => mPrisma) };
});

jest.mock('../../../../services/legalOneApiService', () => ({
    legalOneApiService: { updateContact: jest.fn() },
}));

const prisma = new PrismaClient();

describe('AdminUpdateUserUseCase', () => {
    const existingUser = {
        id: 'user-1',
        name: 'Cliente Exemplo',
        birthDate: null,
        referredById: 'associado-1',
        indication: null,
        legalOneContactId: null,
    };

    /** Banco simulado: o usuário editado e os outros usuários, pelo id. */
    let users: Record<string, any>;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        users = {
            'user-1':      existingUser,
            'associado-1': { role: 'ASSOCIATE' },
            'associado-2': { role: 'ASSOCIATE' },
            'cliente-2':   { role: 'INVESTOR' },
        };
        (prisma.user.findUnique as jest.Mock).mockImplementation(({ where }) => Promise.resolve(users[where.id] ?? null));
        (prisma.user.update as jest.Mock).mockImplementation(({ data }) => Promise.resolve({ ...users['user-1'], ...data }));
        (prisma.investment.updateMany as jest.Mock).mockResolvedValue({ count: 3 });
    });

    /** O `data` que o use case mandou para o Prisma. */
    const updateData = () => (prisma.user.update as jest.Mock).mock.calls[0][0].data;
    /** A transação da edição terminou com erro (e o banco desfaria a edição). */
    const transactionRejected = (message: string) =>
        expect((prisma.$transaction as jest.Mock).mock.results[0].value).rejects.toThrow(message);

    it('trocar de associado cadastrado para nome manual apaga o associado anterior', async () => {
        await new AdminUpdateUserUseCase().execute('user-1', { referredById: null, indication: 'Indicação Manual' });

        expect(updateData()).toMatchObject({ referredById: null, indication: 'Indicação Manual' });
    });

    it('trocar de nome manual para associado cadastrado apaga o nome anterior', async () => {
        users['user-1'] = { ...existingUser, referredById: null, indication: 'Indicação Antiga' };

        await new AdminUpdateUserUseCase().execute('user-1', { referredById: 'associado-2', indication: null });

        expect(updateData()).toMatchObject({ referredById: 'associado-2', indication: null });
    });

    it('não mexe na indicação quando os campos não vêm', async () => {
        await new AdminUpdateUserUseCase().execute('user-1', { name: 'Nome Novo' });

        expect(updateData()).not.toHaveProperty('referredById');
        expect(updateData()).not.toHaveProperty('indication');
    });

    it('edição direta descarta as solicitações de alteração pendentes do usuário', async () => {
        await new AdminUpdateUserUseCase().execute('user-1', { name: 'Nome Novo' }, { supersedePendingRequests: true });

        expect(prisma.userProfileChangeRequest.updateMany).toHaveBeenCalledWith({
            where: { userId: 'user-1', status: 'PENDING' },
            data: expect.objectContaining({ status: 'REJECTED' }),
        });
    });

    it('aprovação de solicitação (sem a opção) não mexe nas outras solicitações', async () => {
        await new AdminUpdateUserUseCase().execute('user-1', { name: 'Nome Novo' });

        expect(prisma.userProfileChangeRequest.updateMany).not.toHaveBeenCalled();
    });

    describe('indicação nova', () => {
        it.each([
            ['um usuário que não é associado', 'cliente-2', 'O usuário indicado não é um associado.'],
            ['um usuário que não existe', 'inexistente', 'O usuário indicado não é um associado.'],
            ['o próprio cliente', 'user-1', 'O cliente não pode ser indicado por ele mesmo.'],
        ])('recusa %s, sem gravar nada', async (_, referredById, message) => {
            await expect(new AdminUpdateUserUseCase().execute('user-1', { referredById })).rejects.toThrow(message);
            expect(prisma.user.update).not.toHaveBeenCalled();
        });

        it('a indicação que não mudou passa como está, mesmo que não seja mais um associado', async () => {
            users['user-1'] = { ...existingUser, referredById: 'cliente-2' };

            await new AdminUpdateUserUseCase().execute('user-1', { referredById: 'cliente-2', name: 'Nome Novo' });

            expect(updateData()).toMatchObject({ referredById: 'cliente-2', name: 'Nome Novo' });
        });
    });

    describe('levar o associado indicado para os processos do cliente', () => {
        it('troca o associado dos processos do cliente, na mesma transação', async () => {
            const result = await new AdminUpdateUserUseCase().execute(
                'user-1', { referredById: 'associado-2', indication: null }, { applyReferralToInvestments: true });

            expect(prisma.investment.updateMany).toHaveBeenCalledWith({ where: { userId: 'user-1' }, data: { associateId: 'associado-2' } });
            expect(result).toMatchObject({ referredById: 'associado-2', investmentsUpdated: 3 });
            expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        });

        it('com a lista da tela, só esses processos mudam', async () => {
            (prisma.investment.updateMany as jest.Mock).mockResolvedValue({ count: 2 });

            const result = await new AdminUpdateUserUseCase().execute(
                'user-1', { referredById: 'associado-2' },
                { applyReferralToInvestments: true, referralInvestmentIds: ['inv-1', 'inv-3'] });

            expect(prisma.investment.updateMany).toHaveBeenCalledWith({
                where: { userId: 'user-1', id: { in: ['inv-1', 'inv-3'] } },
                data:  { associateId: 'associado-2' },
            });
            expect(result.investmentsUpdated).toBe(2);
        });

        it('sem associado cadastrado na indicação, a transação falha e nada fica gravado', async () => {
            await expect(new AdminUpdateUserUseCase().execute(
                'user-1', { referredById: null, indication: 'Indicação Manual' }, { applyReferralToInvestments: true },
            )).rejects.toThrow('Escolha um associado cadastrado para levar aos processos do cliente.');
            await transactionRejected('Escolha um associado cadastrado');
            expect(prisma.investment.updateMany).not.toHaveBeenCalled();
        });

        it('com a indicação de antes, que não é mais um associado, a transação falha', async () => {
            users['user-1'] = { ...existingUser, referredById: 'cliente-2' };

            await expect(new AdminUpdateUserUseCase().execute(
                'user-1', { name: 'Nome Novo' }, { applyReferralToInvestments: true },
            )).rejects.toThrow('O usuário indicado não é um associado.');
            await transactionRejected('O usuário indicado não é um associado.');
            expect(prisma.investment.updateMany).not.toHaveBeenCalled();
        });

        it('sem a opção, a indicação muda e os processos ficam como estão', async () => {
            const result = await new AdminUpdateUserUseCase().execute('user-1', { referredById: 'associado-2' }, { supersedePendingRequests: true });

            expect(prisma.investment.updateMany).not.toHaveBeenCalled();
            expect(result).not.toHaveProperty('investmentsUpdated');
        });
    });
});
