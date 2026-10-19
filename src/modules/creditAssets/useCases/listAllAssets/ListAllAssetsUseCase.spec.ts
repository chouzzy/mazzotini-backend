import { ListAllAssetsUseCase } from './ListAllAssetsUseCase';
import { PrismaClient } from '@prisma/client';

jest.mock('@prisma/client', () => {
    const mPrisma = {
        user: { findUnique: jest.fn() },
        creditAsset: { findMany: jest.fn(), count: jest.fn() },
    };
    return { PrismaClient: jest.fn(() => mPrisma) };
});

const prisma = new PrismaClient();
const searchFilter = { contains: 'silva', mode: 'insensitive' };
const searchClause = {
    OR: [
        { processNumber: searchFilter },
        { originalCreditor: searchFilter },
        { nickname: searchFilter },
    ],
};

/** O `where` que o use case mandou para o Prisma. */
const whereSent = () => (prisma.creditAsset.findMany as jest.Mock).mock.calls[0][0].where;

describe('ListAllAssetsUseCase', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1' });
        (prisma.creditAsset.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.creditAsset.count as jest.Mock).mockResolvedValue(0);
    });

    const useCase = new ListAllAssetsUseCase();

    it('associado buscando: o filtro de acesso continua valendo junto com a busca', async () => {
        await useCase.execute({ auth0UserId: 'auth0|associado', roles: ['ASSOCIATE'], search: 'silva' });

        const where = whereSent();
        // O OR de acesso fica sozinho: só os ativos do próprio associado ou em que ele investe
        expect(where.OR).toEqual([
            { associateId: 'user-1' },
            { investors: { some: { userId: 'user-1' } } },
        ]);
        // A busca entra num AND separado, que restringe em vez de ampliar
        expect(where.AND).toEqual([searchClause]);
        // A contagem usa o mesmo filtro da listagem
        expect((prisma.creditAsset.count as jest.Mock).mock.calls[0][0].where).toBe(where);
    });

    it('associado buscando com filtro de tipo: busca e tipo se somam no AND', async () => {
        await useCase.execute({ auth0UserId: 'auth0|associado', roles: ['ASSOCIATE'], search: 'silva', type: 'LAWSUIT' });

        const where = whereSent();
        expect(where.OR).toHaveLength(2);
        expect(where.AND).toEqual([
            { OR: [{ legalOneType: 'Lawsuit' }, { legalOneType: null }] },
            searchClause,
        ]);
    });

    it('investidor buscando: continua restrito aos próprios investimentos', async () => {
        await useCase.execute({ auth0UserId: 'auth0|investidor', roles: ['INVESTOR'], search: 'silva' });

        const where = whereSent();
        expect(where.investors).toEqual({ some: { userId: 'user-1' } });
        expect(where.OR).toBeUndefined();
        expect(where.AND).toEqual([searchClause]);
    });

    it('papel desconhecido em roles[0] não fica sem filtro: só vê os próprios ativos', async () => {
        // checkRole aceita o token porque INVESTOR está na lista; o use case olha só roles[0]
        await useCase.execute({ auth0UserId: 'auth0|outro', roles: ['OUTRO_PAPEL', 'INVESTOR'] });

        const where = whereSent();
        expect(where.investors).toEqual({ some: { userId: 'user-1' } });
        expect(where.status).toEqual({ notIn: ['FAILED_ENRICHMENT', 'PENDING_ENRICHMENT'] });
    });

    it('admin buscando: vê todos os ativos que casam com o termo', async () => {
        await useCase.execute({ auth0UserId: 'auth0|admin', roles: ['ADMIN'], search: 'silva' });

        const where = whereSent();
        expect(where.OR).toBeUndefined();
        expect(where.investors).toBeUndefined();
        expect(where.AND).toEqual([searchClause]);
    });
});
