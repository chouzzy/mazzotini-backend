/**
 * Valida se é seguro tornar legalOneId obrigatório e único.
 * Execução: npx ts-node check-legalone-ids.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('\n=== Validação pré-migração: legalOneId ===\n');

    const total = await prisma.creditAsset.count();
    const nullIds = await prisma.creditAsset.count({ where: { legalOneId: null } });

    console.log(`Total de ativos : ${total}`);
    console.log(`Com legalOneId  : ${total - nullIds}`);
    console.log(`Sem legalOneId  : ${nullIds}`);

    if (nullIds > 0) {
        const examples = await prisma.creditAsset.findMany({
            where: { legalOneId: null },
            select: { id: true, processNumber: true },
            take: 5
        });
        console.log('\n⚠️  PROBLEMA: Ativos sem legalOneId (primeiros 5):');
        examples.forEach(a => console.log(`   ${a.processNumber} (${a.id})`));
    }

    // Checa duplicatas de legalOneId
    const all = await prisma.creditAsset.findMany({ select: { legalOneId: true, processNumber: true } });
    const idMap: Record<number, string[]> = {};
    for (const a of all) {
        if (a.legalOneId === null) continue;
        if (!idMap[a.legalOneId]) idMap[a.legalOneId] = [];
        idMap[a.legalOneId].push(a.processNumber);
    }
    const duplicates = Object.entries(idMap).filter(([, nums]) => nums.length > 1);

    if (duplicates.length > 0) {
        console.log('\n⚠️  PROBLEMA: legalOneIds duplicados:');
        duplicates.forEach(([id, nums]) => console.log(`   legalOneId ${id}: ${nums.join(', ')}`));
    } else {
        console.log('\n✅ Nenhum legalOneId duplicado.');
    }

    if (nullIds === 0 && duplicates.length === 0) {
        console.log('✅ Seguro aplicar a migração — todos os ativos têm legalOneId único.\n');
    } else {
        console.log('\n❌ Corrija os problemas acima antes de aplicar a migração.\n');
        process.exit(1);
    }
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
