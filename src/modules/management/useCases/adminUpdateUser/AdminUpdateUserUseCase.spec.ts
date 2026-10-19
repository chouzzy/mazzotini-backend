import { AdminUpdateUserUseCase } from './AdminUpdateUserUseCase';
import { PrismaClient } from '@prisma/client';

jest.mock('@prisma/client', () => {
    const mPrisma: any = {
        user: { findUnique: jest.fn(), update: jest.fn() },
        userProfileChangeRequest: { updateMany: jest.fn() },
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
});
