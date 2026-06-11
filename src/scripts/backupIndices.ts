/**
 * Backup da collection IndexSeries para arquivo JSON local.
 *
 * Uso: npx ts-node src/scripts/backupIndices.ts
 *
 * Gera: backups/index-series-YYYY-MM-DD_HH-mm-ss.json
 * Para restaurar: npx ts-node src/scripts/restoreIndices.ts backups/<arquivo>.json
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
    console.log('=== Backup de IndexSeries ===\n');

    const records = await prisma.indexSeries.findMany({ orderBy: [{ indexName: 'asc' }, { year: 'asc' }, { month: 'asc' }] });

    const now       = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
    const backupDir = path.join(process.cwd(), 'backups');
    const filePath  = path.join(backupDir, `index-series-${timestamp}.json`);

    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    fs.writeFileSync(filePath, JSON.stringify(records, null, 2), 'utf-8');

    const byIndex: Record<string, number> = {};
    for (const r of records) byIndex[r.indexName] = (byIndex[r.indexName] ?? 0) + 1;

    console.log(`${records.length} registros salvos em:\n  ${filePath}\n`);
    console.log('Breakdown por índice:');
    for (const [name, count] of Object.entries(byIndex)) {
        console.log(`  ${name.padEnd(16)} ${count} meses`);
    }

    console.log('\n✅ Backup concluído. Para restaurar:\n  npx ts-node src/scripts/restoreIndices.ts backups/<arquivo>.json');
    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
