/**
 * checkUserLinks.ts — mostra tudo vinculado ao usuário antes de deletar
 * Uso: npx ts-node src/scripts/checkUserLinks.ts matheus@awer.co
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const email = process.argv[2];
    if (!email) { console.error('Uso: npx ts-node src/scripts/checkUserLinks.ts <email>'); process.exit(1); }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) { console.log(`Usuário "${email}" não encontrado no banco.`); return; }

    console.log('\n──────────────────────────────────────');
    console.log(`Usuário: ${user.name} (${user.email})`);
    console.log(`ID:      ${user.id}`);
    console.log(`Role:    ${user.role}`);
    console.log(`Auth0:   ${user.auth0UserId}`);
    console.log('──────────────────────────────────────\n');

    const investments = await prisma.investment.findMany({ where: { userId: user.id } });
    console.log(`Investimentos vinculados: ${investments.length}`);
    investments.forEach(i => console.log(`  • creditAssetId: ${i.creditAssetId}`));

    const assetsAsAssociate = await prisma.creditAsset.findMany({ where: { associateId: user.id }, select: { processNumber: true, legalOneId: true } });
    console.log(`\nProcessos onde é associado responsável: ${assetsAsAssociate.length}`);
    assetsAsAssociate.forEach(a => console.log(`  • ${a.processNumber} (legalOneId: ${a.legalOneId})`));

    const stagingDocs = await prisma.userStagingDocument.findMany({ where: { userId: user.id } });
    console.log(`\nDocumentos de staging: ${stagingDocs.length}`);
    stagingDocs.forEach(d => console.log(`  • [${d.category}] ${d.fileUrl}`));

    console.log('\n──────────────────────────────────────');
    console.log('Nada foi deletado. Para deletar, rode deleteUser.ts');
    console.log('──────────────────────────────────────\n');
}

main().catch(console.error).finally(() => prisma.$disconnect());
