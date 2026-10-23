import { GetAssetByProcessNumberUseCase } from './GetAssetByProcessNumberUseCase';
import { PrismaClient } from '@prisma/client';

jest.mock('@prisma/client', () => {
    const mPrisma = {
        creditAsset: { findUnique: jest.fn() },
        user: { findUnique: jest.fn() },
    };
    return { PrismaClient: jest.fn(() => mPrisma) };
});

const prisma = new PrismaClient();

/** Processo fictício com dois clientes: o do associado e o de outro associado. */
const assetWithTwoClients = () => ({
    id: 'asset-1', status: 'Ativo',
    associate: { id: 'associado-a', name: 'Associado A', email: 'a@exemplo.com' },
    investors: [
        { id: 'inv-1', user: { id: 'cliente-1', name: 'Cliente Um', email: 'um@exemplo.com' }, associate: { id: 'associado-a', name: 'Associado A', email: 'a@exemplo.com' } },
        { id: 'inv-2', user: { id: 'cliente-2', name: 'Cliente Dois', email: 'dois@exemplo.com' }, associate: { id: 'associado-b', name: 'Associado B', email: 'b@exemplo.com' } },
    ],
    documents: [
        { id: 'doc-geral', section: 'PROCESSUAL', investorUserId: null },
        { id: 'doc-cliente-1', section: 'PRIVADO_FINANCEIRO', investorUserId: 'cliente-1' },
        { id: 'doc-cliente-2', section: 'PRIVADO_FINANCEIRO', investorUserId: 'cliente-2' },
    ],
});

/** Usuários fictícios, pelo auth0UserId, com o papel gravado no banco. */
const users: Record<string, { id: string; role: string }> = {
    'auth0|cliente-1':   { id: 'cliente-1',   role: 'INVESTOR' },
    'auth0|associado-a': { id: 'associado-a', role: 'ASSOCIATE' },
    'auth0|estranho':    { id: 'estranho',    role: 'INVESTOR' },
    'auth0|admin':       { id: 'admin-1',     role: 'ADMIN' },
};

describe('GetAssetByProcessNumberUseCase', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        (prisma.creditAsset.findUnique as jest.Mock).mockResolvedValue(assetWithTwoClients());
        (prisma.user.findUnique as jest.Mock).mockImplementation(({ where }) => Promise.resolve(users[where.auth0UserId] ?? null));
    });

    const open = (auth0UserId: string, roles: string[]) => new GetAssetByProcessNumberUseCase().execute(4680, auth0UserId, roles);

    it('busca também os andamentos que o enrichment gravou sem a tag na descrição', async () => {
        await open('auth0|admin', ['ADMIN']);

        const query = (prisma.creditAsset.findUnique as jest.Mock).mock.calls[0][0];
        expect(query.where).toEqual({ legalOneId: 4680 });
        expect(query.include.updates.where).toEqual({
            OR: expect.arrayContaining([
                { description: { contains: '#RelatórioMAA' } },
                { source: { contains: '#RelatórioMAA' } },
            ]),
        });
    });

    it('o cliente vê só o próprio investimento e os próprios documentos, sem e-mail de associado', async () => {
        const asset: any = await open('auth0|cliente-1', ['INVESTOR']);

        expect(asset.investors.map((i: any) => i.id)).toEqual(['inv-1']);
        expect(asset.investors[0].associate).toEqual({ id: 'associado-a', name: 'Associado A' });
        expect(asset.associate).toEqual({ id: 'associado-a', name: 'Associado A' });
        expect(asset.documents.map((d: any) => d.id)).toEqual(['doc-geral', 'doc-cliente-1']);
    });

    it('o associado vê só os investimentos dos clientes dele, sem documentos', async () => {
        const asset: any = await open('auth0|associado-a', ['ASSOCIATE']);

        expect(asset.investors.map((i: any) => i.id)).toEqual(['inv-1']);
        expect(asset.documents).toEqual([]);
    });

    it('sem papéis no token, vale o papel do banco: quem não acompanha o processo não abre', async () => {
        await expect(open('auth0|estranho', [])).rejects.toThrow('Acesso negado.');
    });

    it('sem papéis no token, o admin pelo banco vê tudo', async () => {
        const asset: any = await open('auth0|admin', []);

        expect(asset.investors).toHaveLength(2);
        expect(asset.investors[1].user.email).toBe('dois@exemplo.com');
    });

    it('com o papel de cliente no token, quem não investe no processo não abre', async () => {
        await expect(open('auth0|estranho', ['INVESTOR'])).rejects.toThrow('Acesso negado.');
    });
});
