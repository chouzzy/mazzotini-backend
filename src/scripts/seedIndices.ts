/**
 * Seed de índices judiciais
 *
 * Uso: npx ts-node src/scripts/seedIndices.ts
 *
 * Busca séries históricas da API do BCB a partir de jan/2000 e popula
 * a collection IndexSeries no banco.
 *
 * Índices populados:
 *   IPCA_E        — IPCA-E  (usado a partir de jan/2024, Lei 14905)
 *   INPC          — INPC
 *   IPCA          — IPCA
 *   IGP_M         — IGP-M (série BCB 189)
 *   CDI_MENSAL    — CDI acumulado mensal (série BCB 4391)
 *   CDI_DIARIA    — copiado do CDI_MENSAL (série 12 diária indisponível via JSON BCB)
 *   TJSP_LEI14905 — índice híbrido: INPC até 08/2024, IPCA de 09/2024
 *   SELIC         — Meta SELIC diária acumulada (set/2024+, para Taxa Legal P3)
 */

import { PrismaClient } from '@prisma/client';
import { fetchIndexSeries, fetchTJSPSeries, fetchSelicSeries, IBGEDataPoint } from '../services/ibgeService';

const prisma = new PrismaClient();
const START_YEAR  = 2000;
const START_MONTH = 1;

async function upsertSeries(indexName: string, points: IBGEDataPoint[]) {
    let inserted = 0;
    let skipped  = 0;

    for (const p of points) {
        try {
            await prisma.indexSeries.upsert({
                where:  { indexName_year_month: { indexName, year: p.year, month: p.month } },
                create: { indexName, year: p.year, month: p.month, monthlyRate: p.monthlyRate },
                update: { monthlyRate: p.monthlyRate },
            });
            inserted++;
        } catch {
            skipped++;
        }
    }
    console.log(`  ${indexName}: ${inserted} registros inseridos/atualizados, ${skipped} ignorados`);
}

async function mirrorSeriesFromDB(sourceIndex: string, targetIndex: string) {
    const records = await prisma.indexSeries.findMany({ where: { indexName: sourceIndex } });
    await upsertSeries(targetIndex, records.map(r => ({
        year: r.year, month: r.month, monthlyRate: r.monthlyRate,
    })));
}

async function main() {
    console.log('=== Seed de Índices Judiciais ===\n');
    console.log(`Buscando dados de jan/${START_YEAR} até o mês atual...\n`);

    const indices: Array<{ name: string; label: string; fetcher: () => Promise<IBGEDataPoint[]> }> = [
        { name: 'IPCA_E',     label: 'IPCA-E',                                                   fetcher: () => fetchIndexSeries('IPCA_E',     START_YEAR, START_MONTH) },
        { name: 'INPC',       label: 'INPC',                                                     fetcher: () => fetchIndexSeries('INPC',       START_YEAR, START_MONTH) },
        { name: 'IPCA',       label: 'IPCA',                                                     fetcher: () => fetchIndexSeries('IPCA',       START_YEAR, START_MONTH) },
        { name: 'IGP_M',      label: 'IGP-M (série BCB 189)',                                    fetcher: () => fetchIndexSeries('IGP_M',      START_YEAR, START_MONTH) },
        { name: 'CDI_MENSAL', label: 'CDI Acumulado Mensal (série BCB 4391)',                    fetcher: () => fetchIndexSeries('CDI_MENSAL', START_YEAR, START_MONTH) },
        { name: 'TJSP_LEI14905', label: 'TJSP Lei 14905 (INPC até 08/2024 + IPCA de 09/2024)',  fetcher: () => fetchTJSPSeries(START_YEAR, START_MONTH) },
        // SELIC: série 11 diária — só precisamos de set/2024+ (P3 da Taxa Legal)
        { name: 'SELIC', label: 'Meta SELIC diária acumulada (jan/2024+)',                       fetcher: () => fetchSelicSeries(2024, 1) },
    ];

    for (const idx of indices) {
        try {
            console.log(`Buscando ${idx.label}...`);
            const points = await idx.fetcher();
            console.log(`  ${points.length} meses obtidos`);
            await upsertSeries(idx.name, points);
        } catch (err: any) {
            console.error(`  ERRO ao buscar ${idx.label}:`, err.message);
        }
    }

    // CDI_DIARIA: espelha o CDI_MENSAL (mesma série, a API BCB diária não retorna JSON)
    console.log('Espelhando CDI_MENSAL → CDI_DIARIA...');
    await mirrorSeriesFromDB('CDI_MENSAL', 'CDI_DIARIA');

    console.log('\n=== Seed concluído ===');
    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
