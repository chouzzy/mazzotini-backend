/**
 * Utilitários para setup/teardown do banco de testes.
 * Sempre use cleanTestDb() em afterAll para não deixar lixo.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * IDs de assets criados nos testes, para facilitar a limpeza direcionada.
 * Adicione aqui os legalOneIds usados nos mocks para garantir limpeza total.
 */
const TEST_LEGAL_ONE_IDS = [900001, 900002, 900003, 900099];

export async function cleanTestDb() {
    // MongoDB não suporta filtro por relação em deleteMany.
    // Primeiro buscamos os IDs dos assets de teste, depois deletamos os filhos.
    const testAssets = await prisma.creditAsset.findMany({
        where: { legalOneId: { in: TEST_LEGAL_ONE_IDS } },
        select: { id: true }
    });
    const testAssetIds = testAssets.map(a => a.id);

    if (testAssetIds.length > 0) {
        await prisma.assetUpdate.deleteMany({ where: { assetId: { in: testAssetIds } } });
        await prisma.document.deleteMany({ where: { assetId: { in: testAssetIds } } });
        await prisma.investment.deleteMany({ where: { creditAssetId: { in: testAssetIds } } });
    }

    await prisma.creditAsset.deleteMany({ where: { legalOneId: { in: TEST_LEGAL_ONE_IDS } } });
    await prisma.user.deleteMany({ where: { auth0UserId: { startsWith: 'test|' } } });
    await prisma.processFolder.deleteMany({ where: { folderCode: { startsWith: 'Proc-Test-' } } });
}

/**
 * Cria um usuário investidor de teste no banco e retorna seu ID.
 */
export async function createTestUser(suffix = '001'): Promise<string> {
    const user = await prisma.user.upsert({
        where: { auth0UserId: `test|investor-${suffix}` },
        create: {
            auth0UserId: `test|investor-${suffix}`,
            email: `test-investor-${suffix}@mazzotini.test`,
            name: `Investidor de Teste ${suffix}`,
            role: 'INVESTOR',
            status: 'ACTIVE',
        },
        update: {},
    });
    return user.id;
}

export { prisma as testPrisma };
