/**
 * deleteUser.ts — deleta usuário do banco e do Auth0
 * Uso: npx ts-node src/scripts/deleteUser.ts matheus@awer.co
 */
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

async function getAuth0Token(): Promise<string> {
    const res = await axios.post(`https://${process.env.AUTH0_DOMAIN}/oauth/token`, {
        client_id:     process.env.AUTH0_MGMT_CLIENT_ID,
        client_secret: process.env.AUTH0_MGMT_CLIENT_SECRET,
        audience:      `https://${process.env.AUTH0_DOMAIN}/api/v2/`,
        grant_type:    'client_credentials',
    });
    return res.data.access_token;
}

async function main() {
    const email = process.argv[2];
    if (!email) { console.error('Uso: npx ts-node src/scripts/deleteUser.ts <email>'); process.exit(1); }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) { console.log(`Usuário "${email}" não encontrado.`); return; }

    console.log(`\nDeletando: ${user.name} (${user.email}) — ID: ${user.id}`);

    // 1. Investimentos
    const inv = await prisma.investment.deleteMany({ where: { userId: user.id } });
    console.log(`✅ ${inv.count} investimento(s) deletado(s)`);

    // 2. Nullify associateId em processos (caso exista)
    const upd = await prisma.creditAsset.updateMany({ where: { associateId: user.id }, data: { associateId: null } });
    if (upd.count > 0) console.log(`✅ associateId removido de ${upd.count} processo(s)`);

    // 3. Staging docs
    const docs = await prisma.userStagingDocument.deleteMany({ where: { userId: user.id } });
    if (docs.count > 0) console.log(`✅ ${docs.count} staging doc(s) deletado(s)`);

    // 4. Usuário no banco
    await prisma.user.delete({ where: { id: user.id } });
    console.log(`✅ Usuário deletado do banco`);

    // 5. Auth0
    try {
        const token = await getAuth0Token();
        await axios.delete(`https://${process.env.AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(user.auth0UserId)}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        console.log(`✅ Usuário deletado do Auth0`);
    } catch (e: any) {
        console.warn(`⚠️  Falha ao deletar do Auth0: ${e.response?.data?.message || e.message}`);
    }

    console.log('\n✅ Concluído.\n');
}

main().catch(console.error).finally(() => prisma.$disconnect());
