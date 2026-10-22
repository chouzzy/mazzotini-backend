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
 *   TJSP_LEI14905 — tabela do TJSP: INPC do mês anterior até 08/2024, IPCA-15 do mês anterior desde 09/2024
 *   TJPR_MEDIA_INPC_IGPDI — TJPR: média do INPC e do IGP-DI do mês anterior (Decreto 1.544/1995)
 *   TJMG_CORREGEDORIA     — TJMG: tabela da Corregedoria, pelo INPC do mês anterior
 *   SELIC         — Meta SELIC diária acumulada (jan/2024+)
 *   TAXA_LEGAL    — taxa legal da Lei 14.905 (Res. CMN 5.171: SELIC e IPCA-15 do mês anterior), ago/2024+
 *   TAXA_LEGAL_TEMA1368 — taxa legal + Tema 1368 do STJ (SELIC e IPCA-E do mês anterior), mar/1995 a jul/2024
 */

import { PrismaClient } from '@prisma/client';
import {
    fetchIndexSeries, fetchTJSPSeries, fetchTJPRSeries, fetchTJMGSeries, fetchSelicSeries, fetchTaxaLegalSeries,
    fetchTaxaLegalTema1368Series, IBGEDataPoint,
} from '../services/ibgeService';

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
        { name: 'TJSP_LEI14905', label: 'TJSP Lei 14905 (INPC até 08/2024 + IPCA-15 desde 09/2024)', fetcher: () => fetchTJSPSeries(START_YEAR, START_MONTH) },
        { name: 'TJPR_MEDIA_INPC_IGPDI', label: 'TJPR (média INPC/IGP-DI do mês anterior)', fetcher: () => fetchTJPRSeries(START_YEAR, START_MONTH) },
        { name: 'TJMG_CORREGEDORIA',     label: 'TJMG (Corregedoria, INPC do mês anterior)', fetcher: () => fetchTJMGSeries(START_YEAR, START_MONTH) },
        // SELIC: série 11 diária, acumulada por mês, para a correção pela SELIC
        { name: 'SELIC', label: 'Meta SELIC diária acumulada (jan/2024+)',                       fetcher: () => fetchSelicSeries(2024, 1) },
        // Taxa legal dos juros de mora desde 30/08/2024
        { name: 'TAXA_LEGAL', label: 'Taxa legal (SELIC e IPCA-15 do mês anterior, ago/2024+)', fetcher: () => fetchTaxaLegalSeries(2024, 8) },
        // Taxa legal + Tema 1368 dos juros de mora antes de 08/2024 (série histórica)
        { name: 'TAXA_LEGAL_TEMA1368', label: 'Taxa legal + Tema 1368 (SELIC e IPCA-E do mês anterior, mar/1995 a jul/2024)', fetcher: fetchTaxaLegalTema1368Series },
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
