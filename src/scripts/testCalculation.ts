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
    const refY  = now.getFullYear();
    const refM  = now.getMonth() + 1;

    console.log('\n══════════════════════════════════════════════════════');
    console.log('  TESTE DE VALIDAÇÃO — CÁLCULO JUDICIAL');
    console.log(`  Referência: ${String(refM).padStart(2,'0')}/${refY}`);
    console.log('══════════════════════════════════════════════════════\n');

    // Parâmetros do cliente
    const params: CalculationParams = {
        correctionIndex:    'TJSP_LEI14905',
        moratoryRate:       1.0,          // 1% a.m. simples
        moratoryType:       'SIMPLES',
        moratoryStartDate:  null,         // começa da data base
        compensatoryRate:   0,
        compensatoryType:   'SIMPLES',
        feesPercentage:     10,           // 10% honorários
        penaltyPercentage:  10,           // 10% multa Art. 523
        feesOnPenalty:      false,
        installments: [
            {
                baseValue:   1_150_972.30,
                baseDate:    '2010-05-24',
                description: 'Valor base informado pelo cliente',
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
        const result = await calculateJudicialDebt(params, refY, refM);
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
