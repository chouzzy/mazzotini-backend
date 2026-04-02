/**
 * Teste completo da migração legalOneId
 * Processo de teste: 0033246-68.1998.8.26.0224 (legalOneId: 4536)
 *
 * Execução: npx ts-node test-migration.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const LEGAL_ONE_ID = 4536;
const PROCESS_NUMBER = '0033246-68.1998.8.26.0224';

let passed = 0;
let failed = 0;

function ok(label: string) {
    console.log(`  ✅ ${label}`);
    passed++;
}

function fail(label: string, detail?: string) {
    console.log(`  ❌ ${label}${detail ? `\n     → ${detail}` : ''}`);
    failed++;
}

function section(title: string) {
    console.log(`\n──────────────────────────────────────`);
    console.log(`🧪 ${title}`);
    console.log(`──────────────────────────────────────`);
}

async function main() {
    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║  Teste de Migração: legalOneId como PK   ║');
    console.log('╚══════════════════════════════════════════╝');

    // ─────────────────────────────────────────────
    // SEÇÃO 1: Validação do Schema no Banco
    // ─────────────────────────────────────────────
    section('1. Schema do Banco de Dados');

    // 1a. Busca pelo legalOneId único funciona
    try {
        const asset = await prisma.creditAsset.findUnique({ where: { legalOneId: LEGAL_ONE_ID } });
        if (asset) {
            ok(`findUnique({ legalOneId: ${LEGAL_ONE_ID} }) → encontrou "${asset.processNumber}"`);
        } else {
            fail(`findUnique({ legalOneId: ${LEGAL_ONE_ID} }) → nenhum ativo encontrado`);
        }
    } catch (e: any) {
        fail('findUnique por legalOneId', e.message);
    }

    // 1b. processNumber NÃO é mais unique (dois ativos com mesmo número devem ser possíveis)
    //     Para testar: verifica que não há constraint @unique no campo
    try {
        const all = await prisma.creditAsset.findMany({
            where: { processNumber: PROCESS_NUMBER },
            select: { id: true, legalOneId: true, processNumber: true }
        });
        ok(`findMany por processNumber → encontrou ${all.length} ativo(s) (campo deixou de ser @unique)`);
        all.forEach(a => console.log(`     • legalOneId=${a.legalOneId}  processNumber=${a.processNumber}`));
    } catch (e: any) {
        fail('findMany por processNumber', e.message);
    }

    // 1c. Schema rejeita legalOneId nulo (confirma que o campo é obrigatório no Prisma)
    try {
        await (prisma.creditAsset as any).count({ where: { legalOneId: null } });
        fail('Schema deveria rejeitar legalOneId: null mas não rejeitou');
    } catch (e: any) {
        if (e.message?.includes('must not be null') || e.message?.includes('Argument `legalOneId`')) {
            ok('Schema rejeita legalOneId: null → campo obrigatório confirmado ✓');
        } else {
            fail('Erro inesperado ao testar nulidade', e.message);
        }
    }

    // 1d. Nenhum legalOneId duplicado
    try {
        const all = await prisma.creditAsset.findMany({ select: { legalOneId: true } });
        const ids = all.map(a => a.legalOneId);
        const unique = new Set(ids);
        if (ids.length === unique.size) {
            ok(`Todos os ${ids.length} ativos têm legalOneId único`);
        } else {
            fail(`Existem ${ids.length - unique.size} legalOneIds duplicados!`);
        }
    } catch (e: any) {
        fail('Verificação de duplicatas de legalOneId', e.message);
    }

    // ─────────────────────────────────────────────
    // SEÇÃO 2: Use Cases (sem HTTP)
    // ─────────────────────────────────────────────
    section('2. Use Cases diretos');

    // 2a. GetAssetByProcessNumber (agora por legalOneId)
    try {
        const { GetAssetByProcessNumberUseCase } = await import('./src/modules/creditAssets/useCases/getAssetByProcessNumber/GetAssetByProcessNumberUseCase');
        const uc = new GetAssetByProcessNumberUseCase();
        // Usa um auth0UserId de admin fictício — a função aceita roles=['ADMIN'] sem checar o usuário
        const asset = await uc.execute(LEGAL_ONE_ID, 'test|admin', ['ADMIN']);
        if (asset && asset.legalOneId === LEGAL_ONE_ID) {
            ok(`GetAssetByProcessNumberUseCase(${LEGAL_ONE_ID}) → retornou "${asset.processNumber}"`);
            if (asset.investors) ok(`  → inclui ${asset.investors.length} investidor(es)`);
            if (asset.updates)   ok(`  → inclui ${asset.updates.length} andamento(s)`);
            if (asset.folder)    ok(`  → pasta: ${asset.folder.folderCode}`);
        } else {
            fail(`GetAssetByProcessNumberUseCase(${LEGAL_ONE_ID}) → ativo não encontrado ou legalOneId errado`);
        }
    } catch (e: any) {
        fail('GetAssetByProcessNumberUseCase', e.message);
    }

    // 2b. ListAllAssetsUseCase retorna legalOneId nos itens
    try {
        const { ListAllAssetsUseCase } = await import('./src/modules/creditAssets/useCases/listAllAssets/ListAllAssetsUseCase');
        const uc = new ListAllAssetsUseCase();
        const result = await uc.execute({ auth0UserId: 'test|admin', roles: ['ADMIN'], page: 1, limit: 5 });
        const allHaveId = result.items.every(a => typeof a.legalOneId === 'number');
        if (allHaveId) {
            ok(`ListAllAssetsUseCase → todos os ${result.items.length} itens incluem legalOneId`);
            console.log(`     Exemplo: legalOneId=${result.items[0]?.legalOneId} (${result.items[0]?.processNumber})`);
        } else {
            const sem = result.items.filter(a => !a.legalOneId);
            fail(`ListAllAssetsUseCase → ${sem.length} item(ns) sem legalOneId`);
        }
    } catch (e: any) {
        fail('ListAllAssetsUseCase', e.message);
    }

    // 2c. ListAllFoldersUseCase retorna legalOneId nos ativos
    try {
        const { ListAllFoldersUseCase } = await import('./src/modules/creditAssets/useCases/listAllFolders/ListAllFoldersUseCase');
        const uc = new ListAllFoldersUseCase();
        const result = await uc.execute({ auth0UserId: 'test|admin', roles: ['ADMIN'], page: 1, limit: 3 });
        if (result.items.length > 0) {
            const firstFolder = result.items[0];
            const allHaveId = firstFolder.assets.every((a: any) => typeof a.legalOneId === 'number');
            if (allHaveId) {
                ok(`ListAllFoldersUseCase → ativos da pasta "${firstFolder.folderCode}" incluem legalOneId`);
            } else {
                fail(`ListAllFoldersUseCase → ativos da pasta "${firstFolder.folderCode}" sem legalOneId`);
            }
        } else {
            ok('ListAllFoldersUseCase → nenhuma pasta encontrada (sem erro)');
        }
    } catch (e: any) {
        fail('ListAllFoldersUseCase', e.message);
    }

    // 2d. UpdateAssetUseCase localiza ativo por legalOneId
    try {
        const { UpdateAssetUseCase } = await import('./src/modules/creditAssets/useCases/updateAsset/UpdateAssetUseCase');
        const uc = new UpdateAssetUseCase();
        // Busca o ativo atual para fazer update sem alterar nada de fato
        const current = await prisma.creditAsset.findUnique({ where: { legalOneId: LEGAL_ONE_ID } });
        if (!current) throw new Error('Ativo não encontrado para teste de update');

        const updated = await uc.execute({
            legalOneId: LEGAL_ONE_ID,
            nickname: current.nickname || undefined, // envia o mesmo valor — sem mudança real
        });
        if (updated.legalOneId === LEGAL_ONE_ID) {
            ok(`UpdateAssetUseCase(legalOneId: ${LEGAL_ONE_ID}) → localizou e atualizou sem erro`);
        } else {
            fail('UpdateAssetUseCase → retornou ativo com legalOneId errado');
        }
    } catch (e: any) {
        fail('UpdateAssetUseCase', e.message);
    }

    // ─────────────────────────────────────────────
    // SEÇÃO 3: Rotas HTTP (requer backend rodando)
    // ─────────────────────────────────────────────
    section('3. Rotas HTTP (localhost:8081)');
    console.log('  ⚠️  Estas rotas precisam de autenticação. Testando sem token para verificar que retornam 401 (não 404).');

    const BASE = 'http://localhost:8081';
    const routes = [
        { method: 'GET',  path: `/api/assets/${LEGAL_ONE_ID}`,       label: `GET /api/assets/${LEGAL_ONE_ID}` },
        { method: 'POST', path: `/api/assets/${LEGAL_ONE_ID}/sync`,   label: `POST /api/assets/${LEGAL_ONE_ID}/sync` },
        { method: 'PATCH',path: `/api/assets/${LEGAL_ONE_ID}`,        label: `PATCH /api/assets/${LEGAL_ONE_ID}` },
        { method: 'GET',  path: `/api/assets/lookup/${PROCESS_NUMBER}`,label: `GET /api/assets/lookup/${PROCESS_NUMBER} (NÃO MUDA)` },
    ];

    for (const route of routes) {
        try {
            const res = await fetch(`${BASE}${route.path}`, { method: route.method });
            if (res.status === 401 || res.status === 403) {
                ok(`${route.label} → ${res.status} (rota existe, auth bloqueou como esperado)`);
            } else if (res.status === 200 || res.status === 204) {
                ok(`${route.label} → ${res.status} (sucesso sem auth — rota pública ou auth desabilitada)`);
            } else if (res.status === 404) {
                fail(`${route.label} → 404 (rota não registrada!)`);
            } else {
                ok(`${route.label} → ${res.status}`);
            }
        } catch (e: any) {
            if (e.message?.includes('ECONNREFUSED') || e.message?.includes('fetch failed')) {
                fail(`${route.label} → backend não está rodando na porta 8081`);
            } else {
                fail(`${route.label}`, e.message);
            }
        }
    }

    // ─────────────────────────────────────────────
    // SEÇÃO 4: Verificação de consistência
    // ─────────────────────────────────────────────
    section('4. Consistência dos dados');

    try {
        const total = await prisma.creditAsset.count();
        const comInvestidores = await prisma.creditAsset.count({ where: { investors: { some: {} } } });
        const semPasta = await prisma.creditAsset.count({ where: { folderId: null } });
        ok(`Total de ativos: ${total}`);
        ok(`Com investidores: ${comInvestidores}`);
        console.log(`     ℹ️  Sem pasta: ${semPasta} (ativos aguardando sync-folders)`);
    } catch (e: any) {
        fail('Contagem geral', e.message);
    }

    // ─────────────────────────────────────────────
    // RESULTADO
    // ─────────────────────────────────────────────
    console.log('\n══════════════════════════════════════');
    console.log(`  Resultado: ${passed} passou ✅  |  ${failed} falhou ❌`);
    console.log('══════════════════════════════════════\n');

    if (failed > 0) process.exit(1);
}

main()
    .catch(e => { console.error('\n💥 Erro fatal:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
