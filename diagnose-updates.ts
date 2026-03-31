/**
 * DIAGNÓSTICO: Andamentos do processo
 *
 * Execução:
 *   npx ts-node diagnose-updates.ts
 *   npx ts-node diagnose-updates.ts --process-number 0001234-56.2020.8.26.0068
 */

import 'dotenv/config';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { LegalOneAuth } from './src/services/LegalOne/LegalOneAuth';

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const argIdx = args.indexOf('--process-number');
const PROCESS_NUMBER = argIdx !== -1 ? args[argIdx + 1] : '0002576-83.2025.8.26.0100';

const TAG_RELATORIO      = '#RelatórioMAA';
const TAG_RELATORIO_ALT  = '#RelatorioMAA';

const sep = (c = '─', n = 80) => c.repeat(n);

interface RawUpdate {
    id: number;
    description?: string;
    notes?: string | null;
    date?: string;
    originType?: string;
}

// Busca andamentos SEM o filtro originType para ver tudo
async function fetchAllUpdatesRaw(entityId: number): Promise<RawUpdate[]> {
    const auth = new LegalOneAuth();
    const filter = `relationships/any(r: r/linkType eq 'Litigation' and r/linkId eq ${entityId})`;
    let url: string | null = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest/Updates?$filter=${encodeURIComponent(filter)}&$orderby=date desc`;
    let all: RawUpdate[] = [];
    let page = 1;
    while (url) {
        const token = await auth['getAccessToken']();
        const res = await axios.get<{ value: RawUpdate[]; '@odata.nextLink'?: string }>(
            url, { headers: { Authorization: `Bearer ${token}` } }
        );
        const batch = res.data.value || [];
        console.log(`  [Legal One] Página ${page}: ${batch.length} andamentos`);
        all = all.concat(batch);
        url = res.data['@odata.nextLink'] || null;
        page++;
    }
    return all;
}

// Busca andamentos COM o filtro originType eq 'Manual' (como faz o código atual)
async function fetchManualUpdatesOnly(entityId: number): Promise<RawUpdate[]> {
    const auth = new LegalOneAuth();
    const filter = `relationships/any(r: r/linkType eq 'Litigation' and r/linkId eq ${entityId}) and originType eq 'Manual'`;
    let url: string | null = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest/Updates?$filter=${encodeURIComponent(filter)}&$orderby=date desc`;
    let all: RawUpdate[] = [];
    while (url) {
        const token = await auth['getAccessToken']();
        const res = await axios.get<{ value: RawUpdate[]; '@odata.nextLink'?: string }>(
            url, { headers: { Authorization: `Bearer ${token}` } }
        );
        all = all.concat(res.data.value || []);
        url = res.data['@odata.nextLink'] || null;
    }
    return all;
}

function hasTag(desc?: string) {
    if (!desc) return false;
    const d = desc.toLowerCase();
    return d.includes(TAG_RELATORIO.toLowerCase()) || d.includes(TAG_RELATORIO_ALT.toLowerCase());
}

async function main() {
    console.log('\n' + sep('═'));
    console.log(`  DIAGNÓSTICO DE ANDAMENTOS`);
    console.log(`  Processo: ${PROCESS_NUMBER}`);
    console.log(sep('═') + '\n');

    // 1. Busca o ativo no banco
    const asset = await prisma.creditAsset.findUnique({
        where: { processNumber: PROCESS_NUMBER },
        include: { updates: { select: { legalOneUpdateId: true, description: true, date: true } } }
    });

    if (!asset) {
        console.error(`❌ Processo "${PROCESS_NUMBER}" não encontrado no banco.`);
        process.exit(1);
    }

    console.log(`✅ Processo encontrado no banco`);
    console.log(`   ID interno  : ${asset.id}`);
    console.log(`   Legal One ID: ${asset.legalOneId ?? '⚠️  NULL'}`);
    console.log(`   Status      : ${asset.status}`);
    console.log(`   Andamentos no banco: ${asset.updates.length}\n`);

    if (!asset.legalOneId) {
        console.error('❌ PROBLEMA ENCONTRADO: legalOneId é NULL.');
        console.error('   O sistema não consegue buscar andamentos sem o ID do Legal One.');
        console.error('   SOLUÇÃO: Execute a sincronização de dados do processo primeiro.');
        process.exit(1);
    }

    const existingIds = new Set(asset.updates.map(u => u.legalOneUpdateId));

    // 2. Busca TODOS os andamentos (sem filtro de originType)
    console.log(`🔍 Buscando TODOS os andamentos no Legal One (sem filtro de tipo)...`);
    const allUpdates = await fetchAllUpdatesRaw(asset.legalOneId);

    // 3. Busca apenas os 'Manual' (como o código faz)
    console.log(`\n🔍 Buscando apenas originType='Manual' (como o código atual faz)...`);
    const manualUpdates = await fetchManualUpdatesOnly(asset.legalOneId);

    console.log(`\n${sep()}`);
    console.log(`  RESUMO — Legal One`);
    console.log(sep());
    console.log(`  Total de andamentos (todos os tipos) : ${allUpdates.length}`);
    console.log(`  Apenas originType='Manual'           : ${manualUpdates.length}`);

    // Breakdown por originType
    const byOrigin: Record<string, number> = {};
    for (const u of allUpdates) {
        const t = u.originType || 'undefined';
        byOrigin[t] = (byOrigin[t] || 0) + 1;
    }
    console.log(`\n  Breakdown por originType:`);
    for (const [type, count] of Object.entries(byOrigin)) {
        console.log(`    ${type.padEnd(35)} : ${count}`);
    }

    // 4. Analisa andamentos com a tag #RelatórioMAA em TODOS os tipos
    const withTagAll   = allUpdates.filter(u => hasTag(u.description));
    const withTagManual = manualUpdates.filter(u => hasTag(u.description));

    console.log(`\n${sep()}`);
    console.log(`  ANDAMENTOS COM TAG #RelatórioMAA`);
    console.log(sep());
    console.log(`  Em TODOS os tipos : ${withTagAll.length}`);
    console.log(`  Apenas 'Manual'   : ${withTagManual.length}`);

    if (withTagAll.length > withTagManual.length) {
        const escondidos = withTagAll.filter(u => u.originType !== 'Manual');
        console.log(`\n  ⚠️  ${escondidos.length} andamento(s) com #RelatórioMAA estão sendo BLOQUEADOS pelo filtro originType='Manual':`);
        for (const u of escondidos) {
            console.log(`\n  ID: ${u.id} | Data: ${u.date?.slice(0, 10)} | originType: ${u.originType}`);
            console.log(`  Descrição (100 chars): ${(u.description || '').slice(0, 100)}...`);
        }
    }

    // 5. Checa cada andamento com tag: já importado ou novo?
    console.log(`\n${sep()}`);
    console.log(`  STATUS DE CADA ANDAMENTO COM TAG (todos os originTypes)`);
    console.log(sep());

    if (withTagAll.length === 0) {
        console.log(`  ⚠️  Nenhum andamento com #RelatórioMAA encontrado no Legal One.`);
        console.log(`  → Verifique se o texto foi cadastrado com a tag correta no Legal One.`);
    }

    for (const u of withTagAll) {
        const jaNoDb    = existingIds.has(u.id);
        const isManual  = u.originType === 'Manual';
        const passaFiltro = isManual && !jaNoDb;

        const status = jaNoDb
            ? '✅ JÁ IMPORTADO'
            : isManual
                ? '🆕 NOVO — deveria ser importado'
                : `❌ BLOQUEADO (originType='${u.originType}')`;

        console.log(`\n  ID: ${u.id} | Data: ${u.date?.slice(0, 10)} | ${status}`);
        console.log(`  originType : ${u.originType}`);
        const preview = (u.description || '').replace(/\n/g, ' ').slice(0, 120);
        console.log(`  Preview    : ${preview}...`);
    }

    // 6. Andamentos já no banco
    console.log(`\n${sep()}`);
    console.log(`  ANDAMENTOS JÁ NO BANCO (${asset.updates.length})`);
    console.log(sep());
    if (asset.updates.length === 0) {
        console.log('  Nenhum andamento importado ainda.');
    }
    for (const u of asset.updates) {
        const preview = (u.description || '').replace(/\n/g, ' ').slice(0, 70);
        console.log(`  legalOneId: ${String(u.legalOneUpdateId ?? '—').padEnd(10)} | ${u.date?.toISOString().slice(0, 10)} | ${preview}`);
    }

    // 7. Diagnóstico final
    console.log(`\n${sep()}`);
    console.log(`  DIAGNÓSTICO FINAL`);
    console.log(sep());

    if (withTagAll.length === 0) {
        console.log('  ❌ TAG AUSENTE: nenhum andamento com #RelatórioMAA no Legal One.');
        console.log('     → O texto precisa conter exatamente "#RelatórioMAA" ou "#RelatorioMAA".');
    } else {
        const bloqueados = withTagAll.filter(u => u.originType !== 'Manual');
        const jaImportados = withTagAll.filter(u => existingIds.has(u.id));
        const novosValidos = withTagAll.filter(u => u.originType === 'Manual' && !existingIds.has(u.id));

        if (bloqueados.length > 0) {
            console.log(`  ❌ CAUSA RAIZ: ${bloqueados.length} andamento(s) com a tag têm originType != 'Manual'.`);
            console.log(`     O filtro em getProcessUpdates() exige 'originType eq Manual'.`);
            console.log(`     SOLUÇÃO: Remover ou relaxar esse filtro para incluir outros originTypes.`);
        }
        if (jaImportados.length > 0) {
            console.log(`  ℹ️  ${jaImportados.length} andamento(s) com a tag já estão no banco (correto).`);
        }
        if (novosValidos.length > 0) {
            console.log(`  ⚠️  ${novosValidos.length} andamento(s) válidos e novos — deveriam ser importados ao clicar Sincronizar.`);
        }
    }

    console.log('\n' + sep('═') + '\n');
}

main()
    .catch(err => { console.error('Erro fatal:', err.message); process.exit(1); })
    .finally(() => prisma.$disconnect());
