/**
 * test-fee-contracts.ts
 *
 * Script de sondagem da API do Legal One para validar se é viável
 * individualizar documentos de Contratos de Honorários por CPF.
 *
 * Como usar:
 *   npx ts-node scripts/test-fee-contracts.ts
 *   npx ts-node scripts/test-fee-contracts.ts <serviceId>   ← sonda um contrato específico
 *
 * O que o script valida:
 *   1. Autenticação com o Legal One
 *   2. Listagem de contratos de honorários (/services)
 *   3. Participantes de um contrato (Contratante → contactId)
 *   4. CPF do Contratante (/individuals/{contactId})
 *   5. Documentos vinculados ao contrato (/documents?filter=link eq 'Service')
 */

import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const BASE_URL = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
const KEY      = process.env.LEGAL_ONE_CONSUMER_KEY!;
const SECRET   = process.env.LEGAL_ONE_CONSUMER_SECRET!;

// ─── Auth ────────────────────────────────────────────────────────────────────

async function getToken(): Promise<string> {
    const url = `${process.env.LEGAL_ONE_API_BASE_URL}/oauth?grant_type=client_credentials`;
    const res = await axios.get(url, {
        headers: { Authorization: `Basic ${Buffer.from(`${KEY}:${SECRET}`).toString('base64')}` }
    });
    return res.data.access_token;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function header(token: string) {
    return { Authorization: `Bearer ${token}` };
}

function sep(title: string) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  ${title}`);
    console.log('─'.repeat(60));
}

// ─── Steps ───────────────────────────────────────────────────────────────────

async function listServices(token: string, top = 10) {
    sep('PASSO 1 — Listando Contratos de Honorários (/services)');
    const res = await axios.get(`${BASE_URL}/services`, {
        headers: header(token),
        params: { '$top': top, '$select': 'id,folder,status,subject', '$orderby': 'id desc' }
    });
    const items: any[] = res.data.value || [];
    console.log(`Total retornado: ${items.length}\n`);
    items.forEach(s => {
        console.log(`  ID: ${s.id}  |  Pasta: ${s.folder || '(vazia)'}  |  Status: ${s.status || '-'}  |  Assunto: ${s.subject || '-'}`);
    });
    return items;
}

async function getServiceParticipants(token: string, serviceId: number) {
    sep(`PASSO 2 — Participantes do contrato ID ${serviceId}`);
    const res = await axios.get(`${BASE_URL}/services/${serviceId}/participants`, {
        headers: header(token)
    });
    const participants: any[] = res.data.value || [];
    console.log(`Total de participantes: ${participants.length}\n`);
    participants.forEach(p => {
        console.log(`  Tipo: ${p.type || '-'}  |  contactId: ${p.contactId}  |  Nome: ${p.contactName || '-'}  |  Principal: ${p.isMainParticipant}`);
    });
    return participants;
}

async function getContactCpf(token: string, contactId: number) {
    sep(`PASSO 3 — CPF/CNPJ do contato ID ${contactId}`);

    // Tenta como pessoa física (individual) primeiro
    try {
        const res = await axios.get(`${BASE_URL}/individuals/${contactId}`, {
            headers: header(token),
            params: { '$select': 'id,name,identificationNumber' }
        });
        const c = res.data;
        console.log(`  Tipo: Pessoa Física`);
        console.log(`  Nome: ${c.name}`);
        console.log(`  CPF:  ${c.identificationNumber || '(não cadastrado)'}`);
        return { type: 'PF', name: c.name, cpf: c.identificationNumber };
    } catch {
        // Se falhar, tenta como empresa
        try {
            const res = await axios.get(`${BASE_URL}/companies/${contactId}`, {
                headers: header(token),
                params: { '$select': 'id,name,identificationNumber' }
            });
            const c = res.data;
            console.log(`  Tipo: Pessoa Jurídica`);
            console.log(`  Nome: ${c.name}`);
            console.log(`  CNPJ: ${c.identificationNumber || '(não cadastrado)'}`);
            return { type: 'PJ', name: c.name, cpf: c.identificationNumber };
        } catch (e2) {
            console.log(`  ❌ Não foi possível buscar contato ${contactId} como PF nem PJ`);
            return null;
        }
    }
}

async function getServiceDocuments(token: string, serviceId: number) {
    sep(`PASSO 4 — Documentos do contrato ID ${serviceId} (testando link types)`);

    const linkTypes = ['Service', 'Contract', 'Advisory', 'FeeContract', 'Litigation', 'Project'];
    let found = false;

    for (const lt of linkTypes) {
        const filter = `relationships/any(r: r/link eq '${lt}' and r/linkItem/id eq ${serviceId})`;
        const res = await axios.get(`${BASE_URL}/documents`, {
            headers: header(token),
            params: { '$filter': filter }
        });
        const docs: any[] = res.data.value || [];
        if (docs.length > 0) {
            console.log(`\n  ✅ Link type '${lt}': ${docs.length} documento(s)`);
            docs.forEach(d => {
                console.log(`     ID: ${d.id}  |  Archive: ${d.archive || '-'}  |  Tipo: ${d.type || '(sem tipo)'}  |  TypeId: ${d.typeId || '-'}`);
                if (d.relationships?.length) {
                    console.log(`     Relationships: ${JSON.stringify(d.relationships)}`);
                }
            });
            found = true;
        } else {
            console.log(`  ○ Link type '${lt}': 0 documentos`);
        }
    }

    if (!found) {
        console.log('\n  ⚠️  Nenhum documento encontrado com os link types conhecidos.');
        console.log('  Tentando buscar o documento 23905 diretamente para inspecionar seus relationships...');
        try {
            const res = await axios.get(`${BASE_URL}/documents/23905`, { headers: header(token) });
            const d = res.data;
            console.log(`\n  Documento 23905:`);
            console.log(`     Archive: ${d.archive}`);
            console.log(`     Type: ${d.type}`);
            console.log(`     Relationships: ${JSON.stringify(d.relationships, null, 4)}`);
        } catch (e: any) {
            console.log(`  Erro ao buscar doc 23905: ${e.response?.data?.message || e.message}`);
        }
    }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    const serviceIdArg = process.argv[2] ? parseInt(process.argv[2]) : null;

    console.log('\n🔍 Legal One — Teste de Contratos de Honorários');
    console.log('================================================\n');

    const token = await getToken();
    console.log('✅ Autenticação OK\n');

    // Lista contratos recentes
    const services = await listServices(token, 15);

    if (!serviceIdArg) {
        console.log('\n\n💡 Para sondar um contrato específico, rode:');
        console.log('   npx ts-node scripts/test-fee-contracts.ts <ID_DO_CONTRATO>');
        console.log('\n   Crie o contrato de teste no Legal One, anote o ID acima e rode novamente.');
        return;
    }

    // Sonda o contrato específico
    const participants = await getServiceParticipants(token, serviceIdArg);

    // Tenta pegar o CPF do Contratante
    const contratante = participants.find((p: any) =>
        p.type === 'Contratante' || p.type === 'Client' || p.type === 'Contracting party'
    );

    if (contratante) {
        console.log(`\n  → Contratante encontrado: ${contratante.contactName} (contactId: ${contratante.contactId})`);
        await getContactCpf(token, contratante.contactId);
    } else {
        console.log('\n  ⚠️  Nenhum participante do tipo "Contratante" encontrado.');
        console.log('  Tipos disponíveis:', [...new Set(participants.map((p: any) => p.type))].join(', '));
        // Tenta buscar CPF de todos os participantes para ver o que vem
        if (participants.length > 0) {
            console.log('\n  Buscando CPF de todos os participantes para diagnóstico:');
            for (const p of participants) {
                console.log(`\n  → Participante: ${p.contactName} (tipo: ${p.type}, contactId: ${p.contactId})`);
                await getContactCpf(token, p.contactId);
            }
        }
    }

    // Documentos
    await getServiceDocuments(token, serviceIdArg);

    sep('RESULTADO FINAL');
    console.log('  ✅ Viabilidade confirmada se:');
    console.log('     • CPF apareceu no Passo 3');
    console.log('     • Documentos apareceram no Passo 4');
    console.log('     • O tipo do participante "Contratante" foi identificado corretamente\n');
}

main().catch(err => {
    console.error('\n❌ Erro:', err.response?.data || err.message);
    process.exit(1);
});
