/**
 * delete-associate-mock.ts
 * Remove todos os dados criados pelo seed-associate-mock.ts
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const MOCK_TAG = 'MOCK_ASSOC_TEST';
const MOCK_LEGAL_ONE_IDS = [9990001, 9990002, 9990003, 9990004];

async function main() {
    // 1. Buscar usuários mock
    const mockUsers = await prisma.user.findMany({
        where: { email: { contains: MOCK_TAG } },
        select: { id: true, name: true, email: true },
    });
    const mockUserIds = mockUsers.map(u => u.id);
    console.log(`Encontrados ${mockUsers.length} usuários mock:`, mockUsers.map(u => u.name));

    // 2. Buscar processos mock
    const mockAssets = await prisma.creditAsset.findMany({
        where: { legalOneId: { in: MOCK_LEGAL_ONE_IDS } },
        select: { id: true, nickname: true },
    });
    const mockAssetIds = mockAssets.map(a => a.id);
    console.log(`Encontrados ${mockAssets.length} processos mock:`, mockAssets.map(a => a.nickname));

    // 3. Excluir na ordem correta (dependências primeiro)
    if (mockUserIds.length > 0) {
        const del1 = await prisma.investment.deleteMany({ where: { userId: { in: mockUserIds } } });
        console.log(`${del1.count} investimentos excluídos.`);
    }

    if (mockAssetIds.length > 0) {
        const del2 = await prisma.assetUpdate.deleteMany({ where: { assetId: { in: mockAssetIds } } });
        console.log(`${del2.count} andamentos excluídos.`);

        const del3 = await prisma.creditAsset.deleteMany({ where: { id: { in: mockAssetIds } } });
        console.log(`${del3.count} processos excluídos.`);
    }

    if (mockUserIds.length > 0) {
        const del4 = await prisma.user.deleteMany({ where: { id: { in: mockUserIds } } });
        console.log(`${del4.count} usuários mock excluídos.`);
    }

    console.log('\n✅ Mock removido com sucesso!');
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
