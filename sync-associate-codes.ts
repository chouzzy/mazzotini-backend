import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function run() {
    console.log("🚀 Iniciando numeração de associados existentes...");

    // Busca todos os usuários que são associados, ordenados por data de criação
    const associates = await prisma.user.findMany({
        where: {
            role: 'ASSOCIATE'
        },
        orderBy: {
            createdAt: 'asc'
        }
    });

    console.log(`[SYNC] Encontrados ${associates.length} associados.`);

    for (let i = 0; i < associates.length; i++) {
        const sequence = i + 1;
        const associate = associates[i];

        await prisma.user.update({
            where: { id: associate.id },
            data: { associateSequence: sequence }
        });

        const formattedCode = String(sequence).padStart(3, '0');
        console.log(`✅ Associado: ${associate.name} -> Código: ${formattedCode}`);
    }

    console.log("==================================================");
    console.log("✅ Processo concluído com sucesso!");
    await prisma.$disconnect();
}

run().catch(err => {
    console.error("❌ Erro ao numerar associados:", err);
    process.exit(1);
});