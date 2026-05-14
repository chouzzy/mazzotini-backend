/**
 * Seed de índices judiciais
 *
 * Uso: npx ts-node src/scripts/seedIndices.ts
 *
 * Busca séries históricas da API do IBGE a partir de jan/2000 e popula
 * a collection IndexSeries no banco.
 *
 * Índices populados:
 *   IPCA15        — IPCA-15 (usado pelo TJ/SP até dez/2023)
 *   IPCA_E        — IPCA-E  (usado a partir de jan/2024, Lei 14905)
 *   INPC          — INPC
 *   IPCA          — IPCA
 *   TJSP_LEI14905 — índice híbrido: IPCA-15 até 12/2023, IPCA-E de 01/2024
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

async function main() {
    console.log('=== Seed de Índices Judiciais ===\n');
    console.log(`Buscando dados de jan/${START_YEAR} até o mês atual...\n`);

    const indices: Array<{ name: string; label: string; fetcher: () => Promise<IBGEDataPoint[]> }> = [
        { name: 'IPCA_E', label: 'IPCA-E',                          fetcher: () => fetchIndexSeries('IPCA_E', START_YEAR, START_MONTH) },
        { name: 'INPC',   label: 'INPC',                            fetcher: () => fetchIndexSeries('INPC',   START_YEAR, START_MONTH) },
        { name: 'IPCA',   label: 'IPCA',                            fetcher: () => fetchIndexSeries('IPCA',   START_YEAR, START_MONTH) },
        { name: 'TJSP_LEI14905', label: 'TJSP Lei 14905 (INPC até 12/2023 + IPCA-E de 01/2024)', fetcher: () => fetchTJSPSeries(START_YEAR, START_MONTH) },
        { name: 'SELIC', label: 'Meta SELIC (% mensal)', fetcher: () => fetchSelicSeries(START_YEAR, START_MONTH) },
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

    console.log('\n=== Seed concluído ===');
    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
