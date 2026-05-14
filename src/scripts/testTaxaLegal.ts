import { PrismaClient } from '@prisma/client';
import { calculateJudicialDebt } from '../services/judicialCalculatorService';

const prisma = new PrismaClient();
const BRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

async function main() {
    console.log('\n══════════════════════════════════════════════════════');
    console.log('  TESTE — TAXA LEGAL PIECEWISE (art. 406 CC / Lei 14905)');
    console.log('  Base: 01/01/2000  |  Ref: 05/2026  |  R$ 1.000.000,00');
    console.log('  Esperado: R$ 25.067.382,01');
    console.log('══════════════════════════════════════════════════════\n');

    // Confere SELIC no banco
    const selicCount = await prisma.indexSeries.count({ where: { indexName: 'SELIC' } });
    const ipcaCount  = await prisma.indexSeries.count({ where: { indexName: 'IPCA'  } });
    console.log(`SELIC: ${selicCount} meses  |  IPCA: ${ipcaCount} meses\n`);

    // Mostra SELIC e IPCA de set/2024 para conferência
    const recs = await prisma.indexSeries.findMany({
        where: { year: { gte: 2024 }, OR: [{ indexName: 'SELIC' }, { indexName: 'IPCA' }] },
        orderBy: [{ indexName: 'asc' }, { year: 'asc' }, { month: 'asc' }],
    });
    console.log('SELIC e IPCA mensais de set/2024 (período 3):');
    const grouped: Record<string, Record<string, number>> = {};
    for (const r of recs) {
        const key = `${String(r.month).padStart(2,'0')}/${r.year}`;
        if (!grouped[key]) grouped[key] = {};
        grouped[key][r.indexName] = r.monthlyRate;
    }
    for (const [ym, vals] of Object.entries(grouped)) {
        const selic = vals['SELIC'] ?? 0;
        const ipca  = vals['IPCA']  ?? 0;
        const taxaLegal = Math.max(selic - ipca, 0);
        if (selic > 0) console.log(`  ${ym}  SELIC=${selic.toFixed(4)}%  IPCA=${ipca.toFixed(4)}%  → TaxaLegal=${taxaLegal.toFixed(4)}%`);
    }
    console.log();

    const params = {
        correctionIndex: 'TJSP_LEI14905',
        moratoryMode:    'TAXA_LEGAL',
        moratoryRate:    1,
        moratoryType:    'SIMPLES',
        moratoryStartDate: null,
        compensatoryRate: 0,
        compensatoryType: 'SIMPLES',
        feesPercentage:    10,
        penaltyPercentage: 20,
        feesOnPenalty:     false,
        installments: [{ baseValue: 1_000_000, baseDate: '2000-01-01T00:00:00Z', description: 'Caso Jan/2000' }],
    };

    const r = await calculateJudicialDebt(params, 2026, 5);
    const inst = r.installmentResults[0];

    console.log('──────────────────────────────────────────────────');
    console.log(`  Valor Corrigido   : ${BRL(r.correctedValue)}`);
    console.log(`  Juros Moratórios  : ${BRL(r.moratoryInterest)}  (${inst.moratoryMonths} meses)`);
    console.log(`  Honorários 10%    : ${BRL(r.feesValue)}`);
    console.log(`  Multa 20%         : ${BRL(r.penaltyValue)}`);
    console.log('  ──────────────────────────────────────────────');
    console.log(`  TOTAL GERAL       : ${BRL(r.totalValue)}`);
    console.log(`  Esperado          : R$ 25.067.382,01`);
    const diff = Math.abs(r.totalValue - 25_067_382.01);
    console.log(`  Diferença         : R$ ${diff.toFixed(2)}`);
    console.log('══════════════════════════════════════════════════════\n');

    await prisma.$disconnect();
}

main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
