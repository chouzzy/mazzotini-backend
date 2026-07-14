import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const appeals = await prisma.creditAsset.findMany({
        where: { legalOneType: 'Appeal' },
        include: { investors: true },
        orderBy: { processNumber: 'asc' },
    });

    const issues = await prisma.creditAsset.findMany({
        where: { legalOneType: 'ProceduralIssue' },
        include: { investors: true },
        orderBy: { processNumber: 'asc' },
    });

    const all = [...appeals, ...issues];

    console.log(`\n── Recursos (Appeals): ${appeals.length}`);
    appeals.forEach(a => console.log(`  [${a.legalOneId}] ${a.processNumber} — investimentos: ${a.investors.length}`));

    console.log(`\n── Incidentes (ProceduralIssues): ${issues.length}`);
    issues.forEach(i => console.log(`  [${i.legalOneId}] ${i.processNumber} — investimentos: ${i.investors.length}`));

    const comInvestimento = all.filter(a => a.investors.length > 0);
    console.log(`\n⚠️  Total: ${all.length} registros`);
    if (comInvestimento.length > 0) {
        console.log(`🔴 ${comInvestimento.length} têm investimentos vinculados (precisam de atenção especial):`);
        comInvestimento.forEach(a => console.log(`   ${a.processNumber} — ${a.investors.length} investimento(s)`));
    } else {
        console.log(`✅ Nenhum tem investimentos vinculados — seguro deletar`);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
