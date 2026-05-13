/**
 * Importa os valores acumulados TJSP_LEI14905 a partir do JSON do drcalc.net.
 *
 * Formato esperado: [{ "DATA": "Aug-24", "VALOR": "95.912469" }, ...]
 *   DATA  : "MMM-YY" (mês em inglês, ano com 2 dígitos)
 *   VALOR : número em formato americano (ponto = decimal, vírgula = milhar)
 *
 * Uso:
 *   npx ts-node src/scripts/importDrcalcIndexJson.ts
 *   npx ts-node src/scripts/importDrcalcIndexJson.ts <caminho-para-arquivo.json>
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const DEFAULT_FILE = path.join(__dirname, 'data', 'tjsp-accumulated.json');

const MONTH_MAP: Record<string, number> = {
    Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
    Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

function parseValor(s: string): number {
    // Remove thousand-separators (comma), keep decimal point
    return parseFloat(s.replace(/,/g, ''));
}

function parseData(s: string): { year: number; month: number } | null {
    // "Aug-24" → { year: 2024, month: 8 }
    // "Oct-64" → { year: 1964, month: 10 }
    const m = s.match(/^([A-Za-z]{3})-(\d{2})$/);
    if (!m) return null;
    const month = MONTH_MAP[m[1]];
    if (!month) return null;
    const yy = parseInt(m[2], 10);
    // 00-63 → 2000-2063, 64-99 → 1964-1999
    const year = yy >= 64 ? 1900 + yy : 2000 + yy;
    return { year, month };
}

async function main() {
    const filePath = process.argv[2] ?? DEFAULT_FILE;
    const resolved = path.resolve(filePath);

    if (!fs.existsSync(resolved)) {
        console.error(`Arquivo não encontrado: ${resolved}`);
        process.exit(1);
    }

    const raw = JSON.parse(fs.readFileSync(resolved, 'utf-8')) as { DATA: string; VALOR: string }[];
    console.log(`\nLendo ${raw.length} entradas de: ${resolved}`);

    // Parse e ordena
    interface Entry { year: number; month: number; accumulated: number }
    const entries: Entry[] = [];
    for (const item of raw) {
        const date = parseData(item.DATA);
        if (!date) { console.warn(`  Ignorando linha com DATA inválida: "${item.DATA}"`); continue; }
        const accumulated = parseValor(item.VALOR);
        if (isNaN(accumulated) || accumulated <= 0) { console.warn(`  Ignorando VALOR inválido: "${item.VALOR}"`); continue; }
        entries.push({ ...date, accumulated });
    }
    entries.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);

    const first = entries[0];
    const last  = entries[entries.length - 1];
    console.log(`  Período: ${String(first.month).padStart(2,'0')}/${first.year} → ${String(last.month).padStart(2,'0')}/${last.year}`);

    let inserted = 0, errors = 0;

    for (let i = 0; i < entries.length; i++) {
        const e = entries[i];

        // Taxa mensal = variação relativa entre meses consecutivos
        let monthlyRate = 0;
        if (i > 0) {
            const prev = entries[i - 1];
            const expYear  = prev.month === 12 ? prev.year + 1 : prev.year;
            const expMonth = prev.month === 12 ? 1 : prev.month + 1;
            if (expYear === e.year && expMonth === e.month) {
                monthlyRate = ((e.accumulated / prev.accumulated) - 1) * 100;
            }
            // Se não for consecutivo (reset de moeda) monthlyRate fica 0 — ok
        }

        try {
            await prisma.indexSeries.upsert({
                where: { indexName_year_month: { indexName: 'TJSP_LEI14905', year: e.year, month: e.month } },
                create: { indexName: 'TJSP_LEI14905', year: e.year, month: e.month, monthlyRate, accumulatedValue: e.accumulated },
                update: { monthlyRate, accumulatedValue: e.accumulated },
            });
            inserted++;
        } catch (err: any) {
            console.error(`  Erro ${String(e.month).padStart(2,'0')}/${e.year}:`, err.message);
            errors++;
        }
    }

    console.log(`\nResultado: ${inserted} inseridos/atualizados${errors ? `, ${errors} erros` : ''}`);

    // Mostra os últimos 8 meses para conferência rápida
    console.log('\nÚltimos 8 meses:');
    for (let i = Math.max(0, entries.length - 8); i < entries.length; i++) {
        const e = entries[i];
        const prev = i > 0 ? entries[i - 1] : null;
        let rate = 0;
        if (prev) {
            const expY = prev.month === 12 ? prev.year + 1 : prev.year;
            const expM = prev.month === 12 ? 1 : prev.month + 1;
            if (expY === e.year && expM === e.month) rate = ((e.accumulated / prev.accumulated) - 1) * 100;
        }
        console.log(`  ${String(e.month).padStart(2,'0')}/${e.year}  acumulado=${e.accumulated.toFixed(7).padStart(14)}  taxa=${rate.toFixed(4)}%`);
    }

    await prisma.$disconnect();
    console.log('\nImportação concluída.');
}

main().catch(async e => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
