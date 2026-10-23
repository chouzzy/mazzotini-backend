import { PrismaClient } from '@prisma/client';
import { GetMyProfileUseCase } from './GetMyProfileUseCase';

jest.mock('@prisma/client', () => {
    const mPrisma: any = { user: { findUnique: jest.fn() } };
    return { PrismaClient: jest.fn(() => mPrisma) };
});

const prisma = new PrismaClient() as any;

// Cadastro fictício com um processo na carteira e um anexo
const investments = [{
    id: 'inv-1', creditAssetId: 'ativo-1', documents: ['https://exemplo.com/anexo.pdf'],
    asset: { id: 'ativo-1', processNumber: '0000001-00.2020.8.26.0100', nickname: 'Contrato 1', status: 'Ativo' },
}];
const profile = (status: string | null) => ({ id: 'cliente-1', name: 'Cliente Exemplo', status, investments });

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
});

const run = () => new GetMyProfileUseCase().execute('auth0|cliente');

describe('GetMyProfileUseCase', () => {
    it.each([
        ['aprovada', 'ACTIVE'],
        ['antiga, sem status', null],
    ])('conta %s recebe os investimentos', async (_, status) => {
        prisma.user.findUnique.mockResolvedValue(profile(status));

        await expect(run()).resolves.toMatchObject({ status, investments });
    });

    it.each([
        ['no onboarding', 'PENDING_ONBOARDING'],
        ['em análise', 'PENDING_REVIEW'],
    ])('conta %s recebe o próprio cadastro sem os investimentos (os processos e os anexos da carteira)', async (_, status) => {
        prisma.user.findUnique.mockResolvedValue(profile(status));

        await expect(run()).resolves.toEqual({ id: 'cliente-1', name: 'Cliente Exemplo', status, investments: [] });
    });

    it('sem cadastro, devolve null', async () => {
        prisma.user.findUnique.mockResolvedValue(null);

        await expect(run()).resolves.toBeNull();
    });
});
