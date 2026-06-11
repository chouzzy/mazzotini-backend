/**
 * Restaura IndexSeries a partir de um arquivo de backup JSON.
 *
 * Uso: npx ts-node src/scripts/restoreIndices.ts backups/<arquivo>.json
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function main() {
    const filePath = process.argv[2];
    if (!filePath) {
        console.error('Informe o caminho do arquivo: npx ts-node src/scripts/restoreIndices.ts backups/<arquivo>.json');
        process.exit(1);
    }

    if (!fs.existsSync(filePath)) {
        console.error(`Arquivo não encontrado: ${filePath}`);
        process.exit(1);
    }

    const records: any[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    console.log(`=== Restaurando ${records.length} registros de ${filePath} ===\n`);

    let restored = 0;
    for (const r of records) {
        await prisma.indexSeries.upsert({
            where:  { indexName_year_month: { indexName: r.indexName, year: r.year, month: r.month } },
            create: { indexName: r.indexName, year: r.year, month: r.month, monthlyRate: r.monthlyRate, accumulatedValue: r.accumulatedValue ?? null },
            update: { monthlyRate: r.monthlyRate, accumulatedValue: r.accumulatedValue ?? null },
        });
        restored++;
    }

    console.log(`✅ ${restored} registros restaurados com sucesso.`);
    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
