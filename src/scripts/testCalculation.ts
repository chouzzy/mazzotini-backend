/**
 * Script de validação do cálculo judicial
 *
 * Uso: npx ts-node src/scripts/testCalculation.ts
 *
 * Usa os parâmetros reais do cliente e imprime o resultado detalhado
 * para comparar com drcalc.net.
 */

import { PrismaClient } from '@prisma/client';
import { calculateJudicialDebt, CalculationParams } from '../services/judicialCalculatorService';

const prisma = new PrismaClient();

const BRL = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

async function main() {
    const now   = new Date();
    // Data de referência fixa para bater com o drcalc (maio/2026)
    const refY  = 2026;
    const refM  = 5;

    console.log('\n══════════════════════════════════════════════════════');
    console.log('  TESTE DE VALIDAÇÃO — CÁLCULO JUDICIAL');
    console.log(`  Referência: ${String(refM).padStart(2,'0')}/${refY} (fixo para bater com drcalc)`);
    console.log('══════════════════════════════════════════════════════\n');

    // Parâmetros do teste de validação (drcalc.net)
    // drcalc esperado: corrigido=1.401.527,52 | juros=939.023,44 | total=3.089.527,28
    const params: CalculationParams = {
        correctionIndex:    'TJSP_LEI14905',
        moratoryRate:       1.0,
        moratoryType:       'SIMPLES',
        moratoryStartDate:  null,
        compensatoryRate:   0,
        compensatoryType:   'SIMPLES',
        feesPercentage:     10,
        penaltyPercentage:  10,
        feesOnPenalty:      true,   // Art.523: multa 10% + honorários 10% sobre o mesmo total
        installments: [
            {
                baseValue:   1_000_000,
                baseDate:    '2020-10-01',
                description: 'Teste de validação drcalc',
            },
        ],
    };

    console.log('Parâmetros utilizados:');
    console.log(`  Índice de correção : ${params.correctionIndex}`);
    console.log(`  Juros moratórios   : ${params.moratoryRate}% a.m. (${params.moratoryType})`);
    console.log(`  Honorários         : ${params.feesPercentage}%`);
    console.log(`  Multa Art. 523     : ${params.penaltyPercentage}%`);
    console.log(`  Valor base         : ${BRL(params.installments[0].baseValue)}`);
    console.log(`  Data base          : ${params.installments[0].baseDate}`);
    console.log('');

    // Verifica se temos índices no banco
    const indexCount = await prisma.indexSeries.count({
        where: { indexName: 'TJSP_LEI14905' },
    });

    if (indexCount === 0) {
        console.error('❌ ERRO: Nenhum índice TJSP_LEI14905 encontrado no banco.');
        console.error('   Execute primeiro: npx ts-node src/scripts/seedIndices.ts\n');
        await prisma.$disconnect();
        return;
    }

    console.log(`✅ Índices disponíveis: ${indexCount} meses de TJSP_LEI14905\n`);

    try {
        const result = await calculateJudicialDebt(params, refY, refM);  // use fixed ref date
        console.log('\n─── REFERÊNCIA drcalc.net (esperado) ───────────────────');
        console.log('  Valor Corrigido  : R$ 1.401.527,52');
        console.log('  Juros Moratórios : R$   939.023,44');
        console.log('  Honorários 10%   : R$   234.055,10');
        console.log('  Art.523 multa 10%: R$   257.460,61');
        console.log('  Art.523 hon. 10% : R$   257.460,61');
        console.log('  TOTAL GERAL      : R$ 3.089.527,28');
        console.log('─────────────────────────────────────────────────────────');
        const inst   = result.installmentResults[0];

        console.log('══════════════════════════════════════════════════════');
        console.log('  RESULTADO');
        console.log('══════════════════════════════════════════════════════');
        console.log(`  Valor Base              : ${BRL(result.baseTotal)}`);
        console.log(`  Fator de Correção       : ×${inst.correctionFactor.toFixed(6)}`);
        console.log(`  Valor Corrigido         : ${BRL(result.correctedValue)}`);
        console.log(`  Juros Moratórios (${inst.moratoryMonths} m) : ${BRL(result.moratoryInterest)}`);
        console.log(`  Honorários (10%)        : ${BRL(result.feesValue)}`);
        console.log(`  Multa Art. 523 (10%)    : ${BRL(result.penaltyValue)}`);
        console.log('  ─────────────────────────────────────────────────');
        console.log(`  TOTAL GERAL             : ${BRL(result.totalValue)}`);
        console.log('══════════════════════════════════════════════════════\n');

        // Amostra dos últimos 6 meses de índice
        console.log('Últimos 6 meses de índice utilizados:');
        const last6 = inst.monthBreakdown.slice(-6);
        for (const m of last6) {
            const rate = m.monthlyRate === 0
                ? '  (sem dado)'
                : `  ${m.monthlyRate.toFixed(4).replace('.', ',')}%`;
            console.log(`  ${String(m.month).padStart(2,'0')}/${m.year}${rate}  → fator acumulado: ${m.accumulated.toFixed(6)}`);
        }

        // Alerta de meses sem índice
        const missing = inst.monthBreakdown.filter(m => m.monthlyRate === 0);
        if (missing.length > 0) {
            console.log(`\n⚠️  ${missing.length} mês(es) sem índice (taxa = 0%):`,
                missing.slice(0, 5).map(m => `${String(m.month).padStart(2,'0')}/${m.year}`).join(', '),
                missing.length > 5 ? `... +${missing.length - 5}` : ''
            );
            console.log('   Rode o seed novamente se precisar de dados mais recentes.');
        }

    } catch (err: any) {
        console.error('❌ Erro no cálculo:', err.message);
    }

    await prisma.$disconnect();
}

main();
