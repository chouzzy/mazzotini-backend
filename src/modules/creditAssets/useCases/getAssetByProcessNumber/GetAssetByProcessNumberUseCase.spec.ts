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

describe('GetAssetByProcessNumberUseCase', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('busca também os andamentos que o enrichment gravou sem a tag na descrição', async () => {
        (prisma.creditAsset.findUnique as jest.Mock).mockResolvedValue({ id: 'asset-1', investors: [], documents: [] });

        await new GetAssetByProcessNumberUseCase().execute(4680, 'auth0|admin', ['ADMIN']);

        const query = (prisma.creditAsset.findUnique as jest.Mock).mock.calls[0][0];
        expect(query.where).toEqual({ legalOneId: 4680 });
        expect(query.include.updates.where).toEqual({
            OR: expect.arrayContaining([
                { description: { contains: '#RelatórioMAA' } },
                { source: { contains: '#RelatórioMAA' } },
            ]),
        });
    });
});
