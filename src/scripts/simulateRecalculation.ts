/**
 * Simula o recálculo mensal sem gravar nada.
 *
 * Para cada processo com parâmetros de cálculo, calcula pelo mesmo caminho do botão "Calcular" e
 * do cron do dia 5 e mostra o valor atual, o simulado, a diferença, os avisos (como meses sem
 * índice no banco, contados como 0%) e os processos que o cálculo recusa (eles manteriam o valor atual).
 * Só lê o banco.
 *
 * Uso, no servidor e na pasta do backend:
 *   node -r dotenv/config build/scripts/simulateRecalculation.js [MM/AAAA]
 * Sem a data, usa o mês atual, como o cron. Para ver os valores do recálculo de 05/11, rode depois
 * do seed dos índices; antes dele, os meses que faltam no banco aparecem como aviso.
 */

import { prisma } from '../prisma';
import { RunCalculationUseCase } from '../modules/calculator/useCases/runCalculation/RunCalculationUseCase';

const money = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function referenceFrom(arg: string | undefined): { year: number; month: number } {
    if (!arg) {
        const now = new Date();
        return { year: now.getFullYear(), month: now.getMonth() + 1 };
    }
    const match = arg.match(/^(\d{1,2})\/(\d{4})$/);
    if (!match || +match[1] < 1 || +match[1] > 12) throw new Error(`Data de referência inválida (${arg}). Use MM/AAAA.`);
    return { year: +match[2], month: +match[1] };
}

async function main() {
    const ref = referenceFrom(process.argv[2]);
    console.log(`=== Simulação do recálculo, referência ${String(ref.month).padStart(2, '0')}/${ref.year} (nada é gravado) ===\n`);

    const allParams = await prisma.processCalculationParams.findMany();
    const assets = await prisma.creditAsset.findMany({
        where:  { id: { in: allParams.map(p => p.assetId) } },
        select: { id: true, legalOneId: true, processNumber: true, currentValue: true },
    });
    const assetOf = new Map(assets.map(a => [a.id, a]));
    const useCase = new RunCalculationUseCase();

    let refused = 0, withWarnings = 0, changedOver1 = 0, totalBefore = 0, totalAfter = 0;
    for (const params of allParams) {
        const asset   = assetOf.get(params.assetId);
        const name    = asset ? `${asset.legalOneId} ${asset.processNumber}` : params.assetId;
        const current = asset?.currentValue ?? params.lastCalculatedValue ?? 0;
        try {
            const { result } = await useCase.calculate(params, ref.year, ref.month);
            // Sem valor anterior, não há percentual: o processo conta entre os que mudam
            const diff = current ? (result.totalValue / current - 1) * 100 : null;
            if (diff === null ? result.totalValue !== 0 : Math.abs(diff) > 1) changedOver1++;
            if (result.warnings?.length) withWarnings++;
            totalBefore += current;
            totalAfter  += result.totalValue;
            const change = diff === null ? 'sem valor anterior' : `${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%`;
            const note   = result.warnings?.length ? ` | avisos: ${result.warnings.join('; ')}` : '';
            console.log(`${name}: ${money(current)} → ${money(result.totalValue)} (${change})${note}`);
        } catch (e: any) {
            refused++;
            console.log(`${name}: RECUSADO, manteria ${money(current)} | ${e.message}`);
        }
    }

    console.log(`\n${allParams.length} processos com cálculo: ${refused} recusados, ${withWarnings} com avisos, ${changedOver1} mudam mais de 1% (ou não tinham valor).`);
    console.log(`Soma dos que calcularam: ${money(totalBefore)} → ${money(totalAfter)}.`);
    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error(e.message);
    await prisma.$disconnect();
    process.exit(1);
});
