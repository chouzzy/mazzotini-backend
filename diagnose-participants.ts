/**
 * DIAGNÓSTICO: Participantes do processo 0009623-49.2021.8.26.0068
 *
 * Compara o que o Legal One tem (com paginação completa) com o que
 * está salvo no banco, e aponta os motivos de cada participante faltante.
 *
 * Execução:
 *   npx ts-node diagnose-participants.ts
 *   npx ts-node diagnose-participants.ts --process-number 0001234-56.2020.8.26.0068
 */

import 'dotenv/config';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { LegalOneAuth } from './src/services/LegalOne/LegalOneAuth';

const prisma = new PrismaClient();

// Aceita número de processo como argumento opcional
const args = process.argv.slice(2);
const argIdx = args.indexOf('--process-number');
const PROCESS_NUMBER = argIdx !== -1 ? args[argIdx + 1] : '0009623-49.2021.8.26.0068';

// ── Participante com dados do contato ────────────────────────────────────────
interface ParticipantWithContact {
    contactId: number;
    contactName?: string;
    type: string;
    isMainParticipant?: boolean;
    // Dados enriquecidos do /contacts/:id
    cpfOrCnpj?: string | null;
    email?: string | null;
    fetchError?: string;
}

// ── Busca participantes COM paginação (o bug está aqui na versão atual) ──────
async function fetchAllParticipants(legalOneId: number): Promise<ParticipantWithContact[]> {
    const auth = new LegalOneAuth();
    const baseUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest/lawsuits/${legalOneId}/participants`;

    let allParticipants: ParticipantWithContact[] = [];
    let url: string | null = baseUrl;
    let page = 1;

    while (url) {
        const headers = await auth['getAuthHeader']();
        const response = await axios.get<{ value: ParticipantWithContact[]; '@odata.nextLink'?: string }>(
            url, { headers }
        );
        const batch = response.data.value || [];
        console.log(`  [Legal One] Página ${page}: ${batch.length} participantes`);
        allParticipants = allParticipants.concat(batch);
        url = response.data['@odata.nextLink'] || null;
        page++;
    }

    return allParticipants;
}

// ── Busca dados do contato (CPF/CNPJ, e-mail) ────────────────────────────────
async function fetchContactDetails(contactId: number): Promise<{ cpfOrCnpj?: string | null; email?: string | null; error?: string }> {
    try {
        const auth = new LegalOneAuth();
        const headers = await auth['getAuthHeader']();
        const url = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest/contacts/${contactId}`;
        const response = await axios.get<any>(url, { headers });
        const data = response.data;
        return {
            cpfOrCnpj: data.identificationNumber || null,
            email: data.email || null,
        };
    } catch (err: any) {
        return { error: err.message };
    }
}

// ── Separador visual ─────────────────────────────────────────────────────────
const sep = (char = '─', len = 80) => char.repeat(len);

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log('\n' + sep('═'));
    console.log(`  DIAGNÓSTICO DE PARTICIPANTES`);
    console.log(`  Processo: ${PROCESS_NUMBER}`);
    console.log(sep('═') + '\n');

    // 1. Busca o ativo no banco
    const asset = await prisma.creditAsset.findFirst({
        where: { processNumber: PROCESS_NUMBER },
        include: {
            investors: {
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            cpfOrCnpj: true,
                            legalOneContactId: true,
                            auth0UserId: true,
                        }
                    }
                }
            }
        }
    });

    if (!asset) {
        console.error(`❌ Processo "${PROCESS_NUMBER}" não encontrado no banco de dados.`);
        process.exit(1);
    }

    console.log(`✅ Processo encontrado no banco`);
    console.log(`   ID interno : ${asset.id}`);
    console.log(`   Legal One ID: ${asset.legalOneId}`);
    console.log(`   Status     : ${asset.status}`);
    console.log(`   Investidores no banco: ${asset.investors.length}\n`);

    // 2. Busca TODOS os participantes do Legal One (com paginação)
    console.log(`🔍 Buscando participantes no Legal One (com paginação)...`);
    const allParticipants = await fetchAllParticipants(asset.legalOneId!);

    console.log(`\n${sep()}`);
    console.log(`  RESUMO BRUTO — Legal One`);
    console.log(sep());

    // Agrupa por tipo
    const byType: Record<string, ParticipantWithContact[]> = {};
    for (const p of allParticipants) {
        if (!byType[p.type]) byType[p.type] = [];
        byType[p.type].push(p);
    }
    for (const [type, list] of Object.entries(byType)) {
        console.log(`  ${type.padEnd(22)} : ${list.length}`);
    }
    console.log(`  ${'TOTAL'.padEnd(22)} : ${allParticipants.length}`);

    const customers = allParticipants.filter(p => p.type === 'Customer');
    console.log(`\n  → Apenas "Customer" serão sincronizados: ${customers.length}`);

    // IDs dos investidores no banco
    const dbContactIds = new Set(
        asset.investors
            .map(inv => inv.user?.legalOneContactId)
            .filter((id): id is number => id != null)
    );

    const missing = customers.filter(c => !dbContactIds.has(c.contactId));
    const present = customers.filter(c => dbContactIds.has(c.contactId));

    console.log(`  → Já importados no banco   : ${present.length}`);
    console.log(`  → Faltando no banco        : ${missing.length}`);

    // 3. Diagnóstico dos faltantes — busca CPF de cada um
    if (missing.length > 0) {
        console.log(`\n${sep()}`);
        console.log(`  PARTICIPANTES FALTANTES (Customer)`);
        console.log(sep());
        console.log(`  Buscando dados de contato para cada faltante (pode demorar)...\n`);

        let semCpf = 0;
        let cpfDuplicado = 0;
        let semContactId = 0;
        let importavel = 0;

        for (const p of missing) {
            if (!p.contactId) {
                semContactId++;
                console.log(`  [SEM contactId] ${p.contactName || '(sem nome)'}`);
                continue;
            }

            const contact = await fetchContactDetails(p.contactId);
            await new Promise(r => setTimeout(r, 300)); // evita 429

            if (contact.error) {
                console.log(`  [ERRO API]     #${p.contactId} — ${p.contactName} → ${contact.error}`);
                continue;
            }

            const cpf = contact.cpfOrCnpj?.replace(/\D/g, '') || null;

            if (!cpf) {
                semCpf++;
                console.log(`  [SEM CPF]      #${p.contactId} — ${p.contactName || '(sem nome)'} | e-mail: ${contact.email || '—'}`);
                continue;
            }

            // Verifica se já existe alguém com esse CPF no banco (sem vínculo por legalOneContactId)
            const existingByCpf = await prisma.user.findFirst({ where: { cpfOrCnpj: cpf } });

            if (existingByCpf) {
                cpfDuplicado++;
                const isShadow = existingByCpf.auth0UserId.startsWith('legalone|import|');
                console.log(`  [CPF NO BANCO] #${p.contactId} — ${p.contactName} | CPF: ${cpf}`);
                console.log(`                 → Usuário no banco: "${existingByCpf.name}" (${isShadow ? 'shadow' : 'real'}) | legalOneContactId: ${existingByCpf.legalOneContactId ?? 'NULL'}`);
                console.log(`                 ⚠️  Este usuário existe mas NÃO está vinculado como investidor neste processo.`);
            } else {
                importavel++;
                console.log(`  [IMPORTÁVEL]   #${p.contactId} — ${p.contactName} | CPF: ${cpf} | e-mail: ${contact.email || '—'}`);
            }
        }

        console.log(`\n${sep()}`);
        console.log(`  DIAGNÓSTICO FINAL DOS FALTANTES`);
        console.log(sep());
        console.log(`  Total faltantes       : ${missing.length}`);
        console.log(`  Sem contactId         : ${semContactId}  (bug — Legal One não retornou ID)`);
        console.log(`  Sem CPF/CNPJ          : ${semCpf}  (pulados pelo participantHelper — sem como identificar)`);
        console.log(`  CPF já no banco, sem vínculo: ${cpfDuplicado}  (usuário existe, mas não é investidor do processo)`);
        console.log(`  Novos (importáveis)   : ${importavel}  (seria criado shadow user na re-importação)`);
    }

    // 4. Lista os investidores já importados para conferência
    console.log(`\n${sep()}`);
    console.log(`  INVESTIDORES JÁ NO BANCO (${asset.investors.length})`);
    console.log(sep());
    for (const inv of asset.investors) {
        const u = inv.user;
        const isShadow = u?.auth0UserId?.startsWith('legalone|import|') ? ' [shadow]' : '';
        console.log(`  • ${(u?.name || '(sem nome)').padEnd(40)} CPF: ${(u?.cpfOrCnpj || '—').padEnd(18)} contactId: ${u?.legalOneContactId ?? '—'}${isShadow}`);
    }

    // 5. Verifica se a causa raiz é paginação
    console.log(`\n${sep()}`);
    console.log(`  CAUSA RAIZ — PAGINAÇÃO`);
    console.log(sep());
    if (allParticipants.length > 25) {
        console.log(`  ⚠️  O Legal One retornou ${allParticipants.length} participantes total.`);
        console.log(`  ⚠️  A versão atual de getEntityParticipants() NÃO tem paginação.`);
        console.log(`  ⚠️  Provavelmente apenas os primeiros ~25 foram importados.`);
        console.log(`\n  SOLUÇÃO: Atualizar getEntityParticipants() para seguir @odata.nextLink.`);
    } else {
        console.log(`  ✅ Apenas ${allParticipants.length} participantes — paginação não é o problema.`);
        console.log(`  → Verifique os motivos acima (sem CPF, sem contactId, etc).`);
    }

    console.log('\n' + sep('═') + '\n');
}

main()
    .catch(err => { console.error('Erro fatal:', err); process.exit(1); })
    .finally(() => prisma.$disconnect());
