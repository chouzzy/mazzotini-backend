import { PrismaClient } from '@prisma/client';
import { GetAssetEstimationUseCase } from './GetAssetEstimationUseCase';

jest.mock('@prisma/client', () => {
    const mPrisma: any = {
        creditAsset: { findUnique: jest.fn() },
        user: { findUnique: jest.fn() },
        investment: { count: jest.fn() },
    };
    return { PrismaClient: jest.fn(() => mPrisma) };
});

const prisma = new PrismaClient() as any;

// Processos e usuários fictícios
const ASSET_ID       = '64b7f0c2a1b2c3d4e5f60801';
const OTHER_ASSET_ID = '64b7f0c2a1b2c3d4e5f60802';
const users: Record<string, { id: string; role: string }> = {
    'auth0|cliente':   { id: 'cliente-1',   role: 'INVESTOR' },
    'auth0|associado': { id: 'associado-1', role: 'ASSOCIATE' },
    'auth0|outro':     { id: 'outro-1',     role: 'INVESTOR' },
    'auth0|admin':     { id: 'admin-1',     role: 'ADMIN' },
};

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    prisma.creditAsset.findUnique.mockResolvedValue({
        id: ASSET_ID, status: 'Ativo', currentValue: 1000, updateIndexType: 'IPCA', contractualIndexRate: 0, updates: [],
    });
    prisma.user.findUnique.mockImplementation(({ where }: any) => Promise.resolve(users[where.auth0UserId] ?? null));
    // Um investimento só: o cliente investe no ASSET_ID e o associado o acompanha. O filtro que a
    // consulta não mandar fica aberto, para um filtro esquecido no use case aparecer no teste
    const investments = [{ creditAssetId: ASSET_ID, userId: 'cliente-1', associateId: 'associado-1' }];
    prisma.investment.count.mockImplementation(({ where }: any) => Promise.resolve(investments.filter(inv =>
        (where.creditAssetId === undefined || inv.creditAssetId === where.creditAssetId)
        && where.OR.some((c: any) => (c.userId !== undefined && c.userId === inv.userId)
            || (c.associateId !== undefined && c.associateId === inv.associateId))).length));
});

const estimate = (auth0UserId: string, roles: string[] = []) =>
    new GetAssetEstimationUseCase().execute(ASSET_ID, { auth0UserId, roles });

describe('GetAssetEstimationUseCase', () => {
    it.each([
        ['o cliente do processo', 'auth0|cliente', []],
        ['o associado que acompanha o processo', 'auth0|associado', []],
        ['o admin pelo papel do token', 'auth0|outro', ['ADMIN']],
        ['o admin pelo papel do banco (token sem papéis)', 'auth0|admin', []],
    ])('%s vê a estimativa', async (_, auth0UserId, roles) => {
        await expect(estimate(auth0UserId, roles)).resolves.toMatchObject({ currentEstimatedValue: 1000 });
    });

    it('quem não acompanha o processo recebe 404', async () => {
        await expect(estimate('auth0|outro')).rejects.toMatchObject({ statusCode: 404 });
    });

    it.each([
        ['o cliente', 'auth0|cliente'],
        ['o associado', 'auth0|associado'],
    ])('%s de outro processo recebe 404 neste', async (_, auth0UserId) => {
        prisma.creditAsset.findUnique.mockResolvedValue({
            id: OTHER_ASSET_ID, status: 'Ativo', currentValue: 500, updateIndexType: 'IPCA', contractualIndexRate: 0, updates: [],
        });

        await expect(new GetAssetEstimationUseCase().execute(OTHER_ASSET_ID, { auth0UserId, roles: [] }))
            .rejects.toMatchObject({ statusCode: 404 });
    });

    it('com papéis no token, o papel de admin do banco não vale (como no checkRole)', async () => {
        await expect(estimate('auth0|admin', ['INVESTOR'])).rejects.toMatchObject({ statusCode: 404 });
    });

    it('processo ainda sem os dados do Legal One fica oculto para o cliente', async () => {
        prisma.creditAsset.findUnique.mockResolvedValue({ id: ASSET_ID, status: 'PENDING_ENRICHMENT', currentValue: 1000, updates: [] });

        await expect(estimate('auth0|cliente')).rejects.toMatchObject({ statusCode: 404 });
    });

    it('id fora do formato responde 404 sem consultar o banco', async () => {
        await expect(new GetAssetEstimationUseCase().execute('nao-e-id', { auth0UserId: 'auth0|admin', roles: ['ADMIN'] }))
            .rejects.toMatchObject({ statusCode: 404 });
        expect(prisma.creditAsset.findUnique).not.toHaveBeenCalled();
    });
});
