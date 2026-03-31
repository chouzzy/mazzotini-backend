/**
 * Corrige a data (e descrição) de um andamento já importado cujo
 * registro no Legal One foi editado após a importação inicial.
 *
 * Execução:
 *   npx ts-node fix-update-date.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { legalOneApiService } from './src/services/legalOneApiService';

const prisma = new PrismaClient();

const LEGAL_ONE_UPDATE_ID = 3154483;

const TAG_RELATORIO     = '#RelatórioMAA';
const TAG_RELATORIO_ALT = '#RelatorioMAA';

const extractFreeText = (description: string | null | undefined): string => {
    if (!description) return 'Atualização de Valor';
    const descLower = description.toLowerCase();
    let tagToUse = '';
    if (descLower.includes(TAG_RELATORIO.toLowerCase())) tagToUse = TAG_RELATORIO;
    else if (descLower.includes(TAG_RELATORIO_ALT.toLowerCase())) tagToUse = TAG_RELATORIO_ALT;
    else return description;

    const regex = new RegExp(tagToUse, 'i');
    const match = description.match(regex);
    if (match && match.index !== undefined) {
        let after = description.substring(match.index + match[0].length).trim();
        const lastR$ = after.lastIndexOf('R$');
        if (lastR$ !== -1) {
            const newlineAfter = after.indexOf('\n', lastR$);
            if (newlineAfter !== -1) return after.substring(newlineAfter).trim();
        }
        return after;
    }
    return description;
};

async function main() {
    console.log(`\nBuscando andamento ${LEGAL_ONE_UPDATE_ID} no banco...`);
    const record = await prisma.assetUpdate.findFirst({
        where: { legalOneUpdateId: LEGAL_ONE_UPDATE_ID },
        include: { asset: { select: { processNumber: true, legalOneId: true } } }
    });

    if (!record) {
        console.error('❌ Andamento não encontrado no banco.');
        process.exit(1);
    }

    console.log(`  Processo    : ${record.asset.processNumber}`);
    console.log(`  Data atual  : ${record.date.toISOString().slice(0, 10)}`);
    console.log(`  Desc (60ch) : ${record.description.slice(0, 60)}`);

    // Busca os andamentos do processo no Legal One para pegar o estado atual
    console.log(`\nBuscando dados atuais do andamento no Legal One...`);
    const updates = await legalOneApiService.getProcessUpdates(record.asset.legalOneId!);
    const fresh = updates.find(u => u.id === LEGAL_ONE_UPDATE_ID);

    if (!fresh) {
        console.error('❌ Andamento não encontrado no Legal One. Verifique se foi removido.');
        process.exit(1);
    }

    const newDate = new Date(fresh.date);
    const newDescription = extractFreeText(fresh.description);

    console.log(`\n  Data no Legal One  : ${newDate.toISOString().slice(0, 10)}`);
    console.log(`  Desc no Legal One  : ${newDescription.slice(0, 60)}`);

    if (
        newDate.toISOString() === record.date.toISOString() &&
        newDescription === record.description
    ) {
        console.log('\n✅ Dados já estão corretos no banco. Nada a corrigir.');
        return;
    }

    await prisma.assetUpdate.update({
        where: { id: record.id },
        data: {
            date: newDate,
            description: newDescription,
        }
    });

    console.log(`\n✅ Corrigido!`);
    console.log(`   Data: ${record.date.toISOString().slice(0, 10)} → ${newDate.toISOString().slice(0, 10)}`);
    if (newDescription !== record.description) {
        console.log(`   Descrição atualizada.`);
    }
}

main()
    .catch(err => { console.error('Erro fatal:', err.message); process.exit(1); })
    .finally(() => prisma.$disconnect());
