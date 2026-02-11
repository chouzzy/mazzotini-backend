import { PrismaClient } from "@prisma/client";
import { ImportNewAssetsUseCase } from "./src/modules/creditAssets/useCases/importNewAssets/ImportNewAssetsUseCase";

const prisma = new PrismaClient();

async function main() {
    // Lê a data passada no terminal (ex: npx ts-node import-all-assets.ts 2025-01-01)
    const dateArg = process.argv[2];
    const sinceDate = dateArg ? new Date(dateArg) : undefined;

    console.log("🤖 Iniciando Robô de Importação...");
    
    if (sinceDate && !isNaN(sinceDate.getTime())) {
        console.log(`📅 MODO FILTRO: Importando apenas processos criados/modificados após ${sinceDate.toISOString()}`);
    } else if (dateArg) {
        console.error("❌ Data inválida. Use o formato YYYY-MM-DD. Ex: 2025-01-01");
        process.exit(1);
    } else {
        console.log(`📅 MODO TOTAL: Importando TODO o histórico do Legal One. (Isso pode demorar)`);
    }
    
    console.log("--------------------------------------------------");

    const importUseCase = new ImportNewAssetsUseCase();

    // Executa a importação
    await importUseCase.execute(sinceDate);

    console.log("--------------------------------------------------");
    console.log("🏁 Importação finalizada com sucesso!");
}

main()
    .catch(e => {
        console.error("❌ Erro fatal no script:", e);
        process.exit(1);
    })
    .finally(async () => await prisma.$disconnect());