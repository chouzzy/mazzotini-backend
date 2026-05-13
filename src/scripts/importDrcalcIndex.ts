/**
 * Importa os valores acumulados do índice TJSP_LEI14905 a partir da
 * tabela HTML exportada do drcalc.net.
 *
 * Uso:
 *   npx ts-node src/scripts/importDrcalcIndex.ts <caminho-para-o-arquivo.html>
 *
 * Como obter o HTML:
 *   1. Acesse https://drcalc.net/juridico.asp
 *   2. Na tabela "Índice TJSP – Débitos Judiciais (Acumulado)", selecione
 *      todo o conteúdo da página (Ctrl+A) e salve como HTML
 *      (ou use "Salvar como... → Página da Web, somente HTML")
 *   3. Passe o caminho do arquivo salvo para este script
 *
 * O que o script faz:
 *   - Extrai pares (mês/ano → valor acumulado) da tabela HTML
 *   - Calcula a taxa mensal como variação entre meses consecutivos
 *   - Faz upsert em IndexSeries com indexName = 'TJSP_LEI14905'
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const MONTH_MAP: Record<string, number> = {
    'jan': 1, 'fev': 2, 'mar': 3, 'abr': 4, 'mai': 5, 'jun': 6,
    'jul': 7, 'ago': 8, 'set': 9, 'out': 10, 'nov': 11, 'dez': 12,
};

function parseFloatBR(s: string): number {
    const cleaned = s.replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
    return parseFloat(cleaned);
}

function stripHtml(s: string): string {
    return s.replace(/<[^>]+>/g, '').trim();
}

interface Entry {
    year: number;
    month: number;
    accumulated: number;
}

function parseEntries(html: string): Entry[] {
    const entries: Entry[] = [];

    // Match all <tr> blocks
    const trRegex = /<tr[\s\S]*?<\/tr>/gi;
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;

    let trMatch: RegExpExecArray | null;
    while ((trMatch = trRegex.exec(html)) !== null) {
        const rowHtml = trMatch[0];
        const cells: string[] = [];

        let tdMatch: RegExpExecArray | null;
        tdRegex.lastIndex = 0;
        while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
            cells.push(stripHtml(tdMatch[1]));
        }

        // Scan cells for "mmm/yyyy" pattern
        for (let i = 0; i < cells.length; i++) {
            const cell = cells[i].toLowerCase();
            const dateMatch = cell.match(/^([a-z]{3})\/(\d{4})$/);
            if (!dateMatch) continue;

            const monthName = dateMatch[1];
            const year = parseInt(dateMatch[2], 10);
            const month = MONTH_MAP[monthName];
            if (!month) continue;

            // Value expected in the next cell
            const valueCell = cells[i + 1];
            if (!valueCell) continue;
            const accumulated = parseFloatBR(valueCell);
            if (isNaN(accumulated) || accumulated <= 0) continue;

            entries.push({ year, month, accumulated });
            break; // move to next row
        }
    }

    return entries;
}

async function main() {
    const htmlPath = process.argv[2];
    if (!htmlPath) {
        console.error('Uso: npx ts-node src/scripts/importDrcalcIndex.ts <arquivo.html>');
        process.exit(1);
    }

    const resolvedPath = path.resolve(htmlPath);
    if (!fs.existsSync(resolvedPath)) {
        console.error(`Arquivo não encontrado: ${resolvedPath}`);
        process.exit(1);
    }

    console.log(`\nLendo: ${resolvedPath}`);
    const html = fs.readFileSync(resolvedPath, 'utf-8');

    const entries = parseEntries(html);
    if (entries.length === 0) {
        console.error('Nenhuma entrada encontrada. Verifique se o HTML contém a tabela correta.');
        process.exit(1);
    }

    // Sort ascending
    entries.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);

    console.log(`Encontradas ${entries.length} entradas:`);
    console.log(`  Primeira: ${String(entries[0].month).padStart(2,'0')}/${entries[0].year} → ${entries[0].accumulated}`);
    const last = entries[entries.length - 1];
    console.log(`  Última:   ${String(last.month).padStart(2,'0')}/${last.year} → ${last.accumulated}`);
    console.log('');

    let inserted = 0;
    let errors   = 0;

    for (let i = 0; i < entries.length; i++) {
        const e = entries[i];

        // Monthly rate from ratio of consecutive accumulated values
        let monthlyRate = 0;
        if (i > 0) {
            const prev = entries[i - 1];
            const nextYear  = prev.month === 12 ? prev.year + 1 : prev.year;
            const nextMonth = prev.month === 12 ? 1 : prev.month + 1;
            if (nextYear === e.year && nextMonth === e.month) {
                monthlyRate = ((e.accumulated / prev.accumulated) - 1) * 100;
            }
        }

        try {
            await prisma.indexSeries.upsert({
                where: {
                    indexName_year_month: {
                        indexName: 'TJSP_LEI14905',
                        year: e.year,
                        month: e.month,
                    },
                },
                create: {
                    indexName: 'TJSP_LEI14905',
                    year: e.year,
                    month: e.month,
                    monthlyRate: parseFloat(monthlyRate.toFixed(6)),
                    accumulatedValue: e.accumulated,
                },
                update: {
                    monthlyRate: parseFloat(monthlyRate.toFixed(6)),
                    accumulatedValue: e.accumulated,
                },
            });
            inserted++;
        } catch (err: any) {
            console.error(`  Erro em ${String(e.month).padStart(2,'0')}/${e.year}:`, err.message);
            errors++;
        }
    }

    console.log(`\nResultado:`);
    console.log(`  ${inserted} registros inseridos/atualizados`);
    if (errors > 0) console.log(`  ${errors} erros`);

    // Show last 6 months for verification
    const recent = entries.slice(-6);
    console.log('\nÚltimos 6 meses importados:');
    for (let i = Math.max(0, entries.length - 6); i < entries.length; i++) {
        const e = entries[i];
        const prev = entries[i - 1];
        let rate = 0;
        if (prev) {
            const nextYear  = prev.month === 12 ? prev.year + 1 : prev.year;
            const nextMonth = prev.month === 12 ? 1 : prev.month + 1;
            if (nextYear === e.year && nextMonth === e.month) {
                rate = ((e.accumulated / prev.accumulated) - 1) * 100;
            }
        }
        console.log(`  ${String(e.month).padStart(2,'0')}/${e.year}  acumulado=${e.accumulated}  taxa=${rate.toFixed(4)}%`);
    }

    await prisma.$disconnect();
    console.log('\nImportação concluída.');
}

main().catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
