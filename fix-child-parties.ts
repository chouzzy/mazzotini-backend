/**
 * fix-child-parties.ts
 *
 * Corrige processos filhos (Recursos e Incidentes) que herdaram incorretamente
 * as partes (originalCreditor, otherParty, nickname) do processo pai.
 *
 * Para cada filho com legalOneId, busca os participantes reais no Legal One e
 * atualiza os campos se forem diferentes do que está no banco.
 *
 * Execução:  npx ts-node fix-child-parties.ts
 * Dry-run:   npx ts-node fix-child-parties.ts --dry-run
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from "@prisma/client";
import { legalOneApiService } from "./src/services/legalOneApiService";

const prisma = new PrismaClient();
const isDryRun = process.argv.includes('--dry-run');

// Pausa entre chamadas à API do Legal One para evitar 429
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const API_DELAY_MS = 500;

function extractParties(participants: any[]): { originalCreditor: string | null; otherParty: string | null } {
    const customerP = participants.find((p: any) => p.type === "Customer");
    const otherPartyP =
        participants.find((p: any) => p.type === "OtherParty" && p.isMainParticipant) ||
        participants.find((p: any) => p.type === "OtherParty");

    return {
        originalCreditor: customerP?.contactName || null,
        otherParty: otherPartyP?.contactName || null,
    };
}

async function main() {
    console.log(`\n================================================`);
    console.log(`[FIX-PARTES] Correção de partes em processos filhos`);
    if (isDryRun) console.log(`[FIX-PARTES] ⚠️  MODO DRY-RUN — nenhuma alteração será feita`);
    console.log(`================================================\n`);

    // 1. Busca todos os filhos (Appeal ou ProceduralIssue) com legalOneId
    const children = await prisma.creditAsset.findMany({
        where: {
            legalOneType: { in: ['Appeal', 'ProceduralIssue'] },
            legalOneId: { not: null },
        },
        select: {
            id: true,
            processNumber: true,
            legalOneId: true,
            legalOneType: true,
            originalCreditor: true,
            otherParty: true,
            nickname: true,
        },
    });

    console.log(`[FIX-PARTES] ${children.length} processo(s) filho(s) encontrado(s) no banco.\n`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let noChangeCount = 0;

    for (const child of children) {
        const endpointType = child.legalOneType === 'Appeal' ? 'appeals' : 'proceduralissues';
        const label = `[${child.legalOneType}] ${child.processNumber}`;

        try {
            await sleep(API_DELAY_MS);

            const participants = await legalOneApiService.getEntityParticipants(endpointType, child.legalOneId!);

            if (participants.length === 0) {
                console.log(`  ⏩ ${label} — sem participantes no Legal One. Pulando.`);
                skippedCount++;
                continue;
            }

            const { originalCreditor, otherParty } = extractParties(participants);

            if (!originalCreditor && !otherParty) {
                console.log(`  ⏩ ${label} — participantes encontrados mas sem Customer ou OtherParty. Pulando.`);
                skippedCount++;
                continue;
            }

            const newOriginalCreditor = originalCreditor ?? child.originalCreditor;
            const newOtherParty = otherParty ?? child.otherParty;

            const creditorChanged = newOriginalCreditor !== child.originalCreditor;
            const otherPartyChanged = newOtherParty !== child.otherParty;

            if (!creditorChanged && !otherPartyChanged) {
                console.log(`  ✔  ${label} — partes já estão corretas. Sem alteração.`);
                noChangeCount++;
                continue;
            }

            console.log(`\n  🔧 ${label}`);
            if (creditorChanged) {
                console.log(`     originalCreditor: "${child.originalCreditor}" → "${newOriginalCreditor}"`);
            }
            if (otherPartyChanged) {
                console.log(`     otherParty/nickname: "${child.otherParty}" → "${newOtherParty}"`);
            }

            if (!isDryRun) {
                await prisma.creditAsset.update({
                    where: { id: child.id },
                    data: {
                        originalCreditor: newOriginalCreditor,
                        otherParty: newOtherParty,
                        nickname: newOtherParty,
                    },
                });
                console.log(`     ✅ Atualizado.`);
            } else {
                console.log(`     [DRY-RUN] Seria atualizado.`);
            }

            updatedCount++;

        } catch (err: any) {
            console.error(`  ❌ ${label} — erro ao buscar participantes: ${err.message}`);
            errorCount++;
        }
    }

    console.log(`\n================================================`);
    console.log(`[FIX-PARTES] Concluído.`);
    console.log(`  🔧 Atualizados:       ${updatedCount}`);
    console.log(`  ✔  Sem alteração:     ${noChangeCount}`);
    console.log(`  ⏩ Pulados:           ${skippedCount}`);
    console.log(`  ❌ Erros:             ${errorCount}`);
    console.log(`================================================\n`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
