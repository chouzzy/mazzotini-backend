/**
 * merge-shadow-users.ts
 *
 * Detecta e mescla shadow users (importados do Legal One) com usuários reais
 * que possuem o mesmo CPF/CNPJ.
 *
 * Execução: npx ts-node merge-shadow-users.ts
 * Para apenas visualizar sem alterar: npx ts-node merge-shadow-users.ts --dry-run
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const isDryRun = process.argv.includes('--dry-run');

async function main() {
    console.log(`\n================================================`);
    console.log(`[MERGE] Iniciando detecção de shadow users duplicados`);
    if (isDryRun) console.log(`[MERGE] ⚠️  MODO DRY-RUN — nenhuma alteração será feita`);
    console.log(`================================================\n`);

    // 1. Busca todos os usuários com CPF preenchido de uma só vez
    const allUsersWithCpf = await prisma.user.findMany({
        where: { cpfOrCnpj: { not: null } }
    });

    // 2. Separa shadow users de usuários reais em memória
    //    (evita problemas com filtros NOT+startsWith no Prisma MongoDB)
    const shadowUsers = allUsersWithCpf.filter(u => u.auth0UserId.startsWith('legalone|import|'));
    const realUsers   = allUsersWithCpf.filter(u => !u.auth0UserId.startsWith('legalone|import|'));

    console.log(`[MERGE] ${shadowUsers.length} shadow user(s) com CPF encontrado(s).`);
    console.log(`[MERGE] ${realUsers.length} usuário(s) real(is) com CPF encontrado(s).\n`);

    // Índice de usuários reais por CPF para lookup rápido
    const realUsersByCpf = new Map<string, typeof realUsers[0]>();
    for (const u of realUsers) {
        if (u.cpfOrCnpj) realUsersByCpf.set(u.cpfOrCnpj.trim(), u);
    }

    let mergedCount = 0;
    let skippedCount = 0;

    for (const shadow of shadowUsers) {
        const cpf = shadow.cpfOrCnpj!.trim();
        const realUser = realUsersByCpf.get(cpf);

        if (!realUser) {
            console.log(`  ⏩ [${shadow.name.trim()}] CPF ${cpf} sem usuário real correspondente. Pulando.`);
            skippedCount++;
            continue;
        }

        console.log(`\n  🔀 MERGE: "${shadow.name.trim()}"`);
        console.log(`     Shadow: ${shadow.id} (${shadow.auth0UserId})`);
        console.log(`     Real:   ${realUser.id} (${realUser.email})`);

        // 3. Conta os vínculos do shadow user
        const [investmentCount, assetAssociateCount] = await Promise.all([
            prisma.investment.count({ where: { userId: shadow.id } }),
            prisma.creditAsset.count({ where: { associateId: shadow.id } }),
        ]);

        console.log(`     Investments vinculados ao shadow:       ${investmentCount}`);
        console.log(`     CreditAssets com associateId shadow:    ${assetAssociateCount}`);

        if (!isDryRun) {
            await prisma.$transaction(async (tx) => {
                // 4a. Transfere investments
                if (investmentCount > 0) {
                    await tx.investment.updateMany({
                        where: { userId: shadow.id },
                        data: { userId: realUser.id }
                    });
                    console.log(`     ✅ ${investmentCount} investment(s) transferido(s).`);
                }

                // 4b. Transfere referências de associado em ativos
                if (assetAssociateCount > 0) {
                    await tx.creditAsset.updateMany({
                        where: { associateId: shadow.id },
                        data: { associateId: realUser.id }
                    });
                    console.log(`     ✅ ${assetAssociateCount} ativo(s) com associateId atualizado(s).`);
                }

                // 4c. Garante que o usuário real tem o legalOneContactId
                if (!realUser.legalOneContactId && shadow.legalOneContactId) {
                    await tx.user.update({
                        where: { id: realUser.id },
                        data: { legalOneContactId: shadow.legalOneContactId }
                    });
                    console.log(`     ✅ legalOneContactId ${shadow.legalOneContactId} vinculado ao usuário real.`);
                }

                // 4d. Deleta o shadow user
                await tx.user.delete({ where: { id: shadow.id } });
                console.log(`     🗑  Shadow user deletado.`);
            });

            mergedCount++;
        } else {
            console.log(`     [DRY-RUN] Nenhuma alteração seria feita — apenas os dados acima.`);
            mergedCount++;
        }
    }

    console.log(`\n================================================`);
    console.log(`[MERGE] Concluído.`);
    console.log(`  🔀 Mesclados: ${mergedCount}`);
    console.log(`  ⏩ Pulados:   ${skippedCount}`);
    console.log(`================================================\n`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
