import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const emailArg = process.argv[2];
    if (!emailArg) {
        console.error('Uso: npx ts-node scripts/check-user.ts <email>');
        process.exit(1);
    }

    const user = await prisma.user.findFirst({
        where: { email: { contains: emailArg, mode: 'insensitive' } },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            status: true,
            cpfOrCnpj: true,
            legalOneContactId: true,
            auth0UserId: true,
            createdAt: true,
            approvedAt: true,
        },
    });

    if (!user) {
        console.log(`Nenhum usuário encontrado com email contendo "${emailArg}"`);
        return;
    }

    console.log('\n── Usuário encontrado ─────────────────────────────────');
    console.log(`  ID:              ${user.id}`);
    console.log(`  Email:           ${user.email}`);
    console.log(`  Nome:            ${user.name}`);
    console.log(`  Role:            ${user.role}`);
    console.log(`  Status:          ${user.status}`);
    console.log(`  CPF/CNPJ:        ${user.cpfOrCnpj ?? '(não preenchido)'}`);
    console.log(`  LegalOne ID:     ${user.legalOneContactId ?? '(não vinculado)'}`);
    console.log(`  Auth0 Sub:       ${user.auth0UserId}`);
    console.log(`  Criado em:       ${user.createdAt?.toLocaleString('pt-BR')}`);
    console.log(`  Aprovado em:     ${user.approvedAt?.toLocaleString('pt-BR') ?? '(não aprovado)'}`);
    console.log('────────────────────────────────────────────────────────\n');
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
