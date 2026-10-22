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

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        (prisma.user.findUnique as jest.Mock).mockResolvedValue(existingUser);
        (prisma.user.update as jest.Mock).mockImplementation(({ data }) => Promise.resolve({ ...existingUser, ...data }));
    });

    /** O `data` que o use case mandou para o Prisma. */
    const updateData = () => (prisma.user.update as jest.Mock).mock.calls[0][0].data;

    it('trocar de associado cadastrado para nome manual apaga o associado anterior', async () => {
        await new AdminUpdateUserUseCase().execute('user-1', { referredById: null, indication: 'Indicação Manual' });

        expect(updateData()).toMatchObject({ referredById: null, indication: 'Indicação Manual' });
    });

    it('trocar de nome manual para associado cadastrado apaga o nome anterior', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...existingUser, referredById: null, indication: 'Indicação Antiga' });

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

    describe('levar o associado indicado para os processos do cliente', () => {
        const comAssociado = (role: string) => (prisma.user.findUnique as jest.Mock)
            .mockResolvedValueOnce(existingUser)        // o usuário editado
            .mockResolvedValueOnce({ role });           // o associado indicado

        it('troca o associado de todos os processos do cliente, na mesma transação', async () => {
            comAssociado('ASSOCIATE');
            (prisma.investment.updateMany as jest.Mock).mockResolvedValue({ count: 3 });

            const result = await new AdminUpdateUserUseCase().execute(
                'user-1', { referredById: 'associado-2', indication: null }, { applyReferralToInvestments: true });

            expect(prisma.investment.updateMany).toHaveBeenCalledWith({ where: { userId: 'user-1' }, data: { associateId: 'associado-2' } });
            expect(result).toMatchObject({ referredById: 'associado-2', investmentsUpdated: 3 });
            expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        });

        it('sem associado cadastrado na indicação, recusa', async () => {
            await expect(new AdminUpdateUserUseCase().execute(
                'user-1', { referredById: null, indication: 'Indicação Manual' }, { applyReferralToInvestments: true },
            )).rejects.toThrow('Escolha um associado cadastrado para levar aos processos do cliente.');
            expect(prisma.investment.updateMany).not.toHaveBeenCalled();
        });

        it('recusa quando o indicado não é um associado', async () => {
            comAssociado('INVESTOR');

            await expect(new AdminUpdateUserUseCase().execute(
                'user-1', { referredById: 'cliente-2' }, { applyReferralToInvestments: true },
            )).rejects.toThrow('O usuário indicado não é um associado.');
            expect(prisma.investment.updateMany).not.toHaveBeenCalled();
        });

        it('sem a opção, a indicação muda e os processos ficam como estão', async () => {
            const result = await new AdminUpdateUserUseCase().execute('user-1', { referredById: 'associado-2' }, { supersedePendingRequests: true });

            expect(prisma.investment.updateMany).not.toHaveBeenCalled();
            expect(result).not.toHaveProperty('investmentsUpdated');
        });
    });
});
