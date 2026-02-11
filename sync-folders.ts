import { PrismaClient } from "@prisma/client";
import { legalOneApiService } from "./src/services/legalOneApiService";
import { ensureProcessFolderExists } from "./src/utils/folderHelper";

const prisma = new PrismaClient();

// Função auxiliar de espera
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    console.log("📂 Iniciando migração de pastas para processos existentes...");

    // 1. Busca TODOS os ativos (independente de terem pasta ou não)
    // Isso contorna o problema do Prisma/Mongo não achar campos recém-criados na query
    const allAssets = await prisma.creditAsset.findMany({
        select: { 
            id: true, 
            processNumber: true, 
            legalOneId: true, 
            legalOneType: true, 
            nickname: true,
            folderId: true // Precisamos selecionar para filtrar depois
        }
    });

    console.log(`📊 Total de ativos no banco: ${allAssets.length}`);

    // 2. Filtra no JavaScript (Infalível)
    const assetsToMigrate = allAssets.filter(asset => !asset.folderId);

    console.log(`🔍 Encontrados ${assetsToMigrate.length} ativos que precisam de pasta.`);

    let count = 0;

    for (const asset of assetsToMigrate) {
        try {
            if (!asset.legalOneId) {
                console.log(`⚠️ Pular asset ${asset.processNumber} (Sem ID Legal One)`);
                continue;
            }

            console.log(`Processando: ${asset.processNumber}...`);

            // 3. Busca detalhes no Legal One para pegar o código da pasta ("folder")
            let folderCode = "";
            let folderTitle = asset.nickname || ""; 

            try {
                if (asset.legalOneType === 'Lawsuit') {
                    const details = await legalOneApiService.getProcessDetails(asset.processNumber);
                    folderCode = details.folder;
                    if (!folderTitle) folderTitle = details.title;
                } else if (asset.legalOneType === 'Appeal') {
                    const details = await legalOneApiService.getAppealDetails(asset.processNumber);
                    folderCode = details.folder;
                    if (!folderTitle) folderTitle = details.title;
                } else if (asset.legalOneType === 'ProceduralIssue') {
                    const details = await legalOneApiService.getProceduralIssueDetails(asset.processNumber);
                    folderCode = details.folder;
                    if (!folderTitle) folderTitle = details.title;
                }
            } catch (err) {
                console.warn(`   -> Falha ao buscar detalhes no Legal One. Ignorando.`);
                continue;
            }

            if (!folderCode) {
                console.warn(`   -> API não retornou código de pasta.`);
                continue;
            }

            // 4. Usa o helper para criar/encontrar a pasta
            const folderId = await ensureProcessFolderExists(folderCode, folderTitle);

            if (folderId) {
                // 5. Atualiza o ativo
                await prisma.creditAsset.update({
                    where: { id: asset.id },
                    data: { folderId: folderId }
                });
                console.log(`   ✅ Vinculado à pasta: ${folderCode}`);
                count++;
            }

            await wait(200);

        } catch (error: any) {
            console.error(`   ❌ Erro no asset ${asset.id}:`, error.message);
        }
    }

    console.log(`\n🏁 Migração concluída! ${count} processos organizados em pastas.`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => await prisma.$disconnect());