import { PrismaClient } from '@prisma/client';
import { UpdateUserInvestmentsUseCase } from './UpdateUserInvestmentsUseCase';

jest.mock('@prisma/client', () => {
    const mPrisma: any = {
        user: { findUnique: jest.fn(), count: jest.fn() },
        creditAsset: { count: jest.fn() },
        investment: { findMany: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn() },
    };
    mPrisma.$transaction = jest.fn((fn: (tx: any) => unknown) => fn(mPrisma));
    return { PrismaClient: jest.fn(() => mPrisma) };
});

const prisma = new PrismaClient() as any;

// Ids fictícios no formato do Mongo
const ASSET_A   = '64b7f0c2a1b2c3d4e5f60901';
const ASSET_B   = '64b7f0c2a1b2c3d4e5f60902';
const ASSOCIATE = '64b7f0c2a1b2c3d4e5f60903';
const INVESTOR  = '64b7f0c2a1b2c3d4e5f60904';   // usuário que não é associado
const CLIENT    = '64b7f0c2a1b2c3d4e5f60905';

/** Papéis dos usuários fictícios. O filtro que a consulta não mandar fica aberto. */
const roles: Record<string, string> = { [ASSOCIATE]: 'ASSOCIATE', [INVESTOR]: 'INVESTOR' };

beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({ id: 'cliente-1' });
    prisma.creditAsset.count.mockImplementation(({ where }: any) => Promise.resolve(where.id.in.length));
    prisma.investment.findMany.mockResolvedValue([{ creditAssetId: ASSET_A, acquisitionDate: new Date('2024-03-01T00:00:00Z'), associateId: null }]);
    prisma.user.count.mockImplementation(({ where }: any) => Promise.resolve(where.id.in
        .filter((id: string) => id in roles && (where.role === undefined || roles[id] === where.role)).length));
});

const save = (investments: any[]) => new UpdateUserInvestmentsUseCase().execute({ userId: 'cliente-1', investments });
const created = () => prisma.investment.createMany.mock.calls[0][0].data;

describe('UpdateUserInvestmentsUseCase', () => {
    it('mantém a data de aquisição dos processos que continuam na carteira', async () => {
        await save([
            { assetId: ASSET_A, share: 0, associateId: ASSOCIATE },
            { assetId: ASSET_B, share: 0 },
        ]);

        expect(created()).toEqual([
            expect.objectContaining({ creditAssetId: ASSET_A, associateId: ASSOCIATE, acquisitionDate: new Date('2024-03-01T00:00:00Z') }),
            expect.objectContaining({ creditAssetId: ASSET_B, associateId: null, acquisitionDate: null }),
        ]);
    });

    it('recusa um processo que não existe mais, sem apagar a carteira', async () => {
        prisma.creditAsset.count.mockResolvedValue(1);

        await expect(save([{ assetId: ASSET_A, share: 0 }, { assetId: ASSET_B, share: 0 }]))
            .rejects.toThrow('Um dos processos da carteira não existe mais.');
        expect(prisma.investment.deleteMany).not.toHaveBeenCalled();
    });

    it.each([
        ['processo', [{ assetId: 'nao-e-id', share: 0 }], 'Processo inválido na carteira.'],
        ['associado', [{ assetId: ASSET_A, share: 0, associateId: 'nao-e-id' }], 'Associado inválido na carteira.'],
    ])('recusa %s com id fora do formato', async (_, investments, message) => {
        await expect(save(investments)).rejects.toThrow(message);
        expect(prisma.investment.deleteMany).not.toHaveBeenCalled();
    });

    describe('associado dos processos', () => {
        it('recusa um associado novo que não é associado cadastrado, sem apagar a carteira', async () => {
            await expect(save([{ assetId: ASSET_A, share: 0, associateId: INVESTOR }]))
                .rejects.toThrow('Um dos associados da carteira não é um associado cadastrado.');
            expect(prisma.investment.deleteMany).not.toHaveBeenCalled();
        });

        it('recusa o próprio cliente como associado', async () => {
            await expect(new UpdateUserInvestmentsUseCase().execute({ userId: CLIENT, investments: [{ assetId: ASSET_A, share: 0, associateId: CLIENT }] }))
                .rejects.toThrow('O cliente não pode ser o associado dos próprios processos.');
            expect(prisma.investment.deleteMany).not.toHaveBeenCalled();
        });

        it('o associado que já estava no processo passa como está, mesmo sem o papel (carteira antiga)', async () => {
            prisma.investment.findMany.mockResolvedValue([{ creditAssetId: ASSET_A, acquisitionDate: null, associateId: INVESTOR }]);

            await save([{ assetId: ASSET_A, share: 0, associateId: INVESTOR }]);

            expect(prisma.user.count).not.toHaveBeenCalled();
            expect(created()).toEqual([expect.objectContaining({ creditAssetId: ASSET_A, associateId: INVESTOR })]);
        });

        it('o mesmo associado levado para outro processo conta como novo', async () => {
            prisma.investment.findMany.mockResolvedValue([{ creditAssetId: ASSET_A, acquisitionDate: null, associateId: INVESTOR }]);

            await expect(save([{ assetId: ASSET_A, share: 0, associateId: INVESTOR }, { assetId: ASSET_B, share: 0, associateId: INVESTOR }]))
                .rejects.toThrow('Um dos associados da carteira não é um associado cadastrado.');
        });
    });

    it('carteira vazia apaga os investimentos sem consultar processos', async () => {
        await save([]);

        expect(prisma.creditAsset.count).not.toHaveBeenCalled();
        expect(prisma.investment.deleteMany).toHaveBeenCalledWith({ where: { userId: 'cliente-1' } });
        expect(prisma.investment.createMany).not.toHaveBeenCalled();
    });
});
