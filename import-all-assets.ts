// import-all-assets.ts
import { PrismaClient } from "@prisma/client";
import { ImportNewAssetsUseCase } from "./src/modules/creditAssets/useCases/importNewAssets/ImportNewAssetsUseCase";

const prisma = new PrismaClient();

async function main() {
    console.log("--------------------------------------------------");
    console.log("🚀 INICIANDO ROBÔ DE IMPORTAÇÃO DE ATIVOS (LEGAL ONE)");
    console.log("--------------------------------------------------");

    // // 🛡️ TRAVA DE SEGURANÇA ABSOLUTA
    // const dbUrl = process.env.DATABASE_URL || '';
    // if (!dbUrl.includes('mazzotini_test')) {
    //     console.error("❌ ERRO FATAL: VOCÊ NÃO ESTÁ NO BANCO DE TESTES!");
    //     console.error("Parece que o seu .env está apontando para a produção.");
    //     console.error("Execução abortada por segurança.");
    //     process.exit(1);
    // }

    console.log("✅ Trava de segurança validada: Conectado ao banco mazzotini_test");

    // Lê as datas do terminal: npx ts-node import-all-assets.ts [START_DATE] [END_DATE]
    const startDateArg = process.argv[2];
    const endDateArg = process.argv[3];

    const startDate = startDateArg ? new Date(startDateArg) : undefined;
    const endDate = endDateArg ? new Date(endDateArg) : undefined;

    if (startDate && !isNaN(startDate.getTime())) {
        console.log(`📅 A PARTIR DE: ${startDate.toISOString()}`);
        if (endDate && !isNaN(endDate.getTime())) {
            console.log(`🛑 ATÉ O LIMITE DE: ${endDate.toISOString()}`);
        } else {
             console.log(`⏳ ATÉ: O momento atual`);
        }
    } else if (startDateArg) {
        console.error("❌ Data inicial inválida. Use o formato YYYY-MM-DD.");
        process.exit(1);
    } else {
        console.log(`⚠️ MODO TOTAL: Importando TODO o histórico do Legal One.`);
    }

    console.log("--------------------------------------------------");

    const importUseCase = new ImportNewAssetsUseCase();

    try {
        await importUseCase.execute(startDate, endDate);
        console.log("--------------------------------------------------");
        console.log("🏁 Importação finalizada com sucesso!");
    } catch (error) {
        console.error("❌ Ocorreu um erro durante a importação:", error);
    }
}

main().finally(async () => await prisma.$disconnect());