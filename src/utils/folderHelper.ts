import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Recebe o código da pasta do Legal One (ex: "Proc - 0002356/001" ou "Proc - 0002356")
 * e garante que a Pasta Pai ("Proc - 0002356") exista no banco de dados.
 * * Lógica:
 * 1. Limpa o sufixo (/001, /002) para encontrar a raiz.
 * 2. Busca no banco.
 * 3. Se não existir, cria.
 * * @param rawFolderCode O código da pasta vindo do Legal One.
 * @param title Um título opcional (geralmente o título do Processo Principal) para dar nome à pasta.
 * @returns O ID (ObjectId) da pasta no banco de dados, ou null se não houver código.
 */
export const ensureProcessFolderExists = async (rawFolderCode?: string | null, title?: string | null): Promise<string | null> => {
    if (!rawFolderCode) return null;

    // 1. Limpa o código para pegar a raiz (Remove o /001, /002, etc)
    // Ex: "Proc - 0002356/001" vira "Proc - 0002356"
    const rootFolderCode = rawFolderCode.split('/')[0].trim();

    try {
        // 2. Tenta encontrar a pasta existente
        const existingFolder = await prisma.processFolder.findUnique({
            where: { folderCode: rootFolderCode }
        });

        if (existingFolder) {
            // Se já existe, retorna o ID
            return existingFolder.id;
        }

        // 3. Se não existe, cria uma nova
        // Se um título foi passado, usamos. Senão, usamos o próprio código como descrição.
        console.log(`[FOLDER] Criando nova pasta para o código raiz: ${rootFolderCode}`);
        
        const newFolder = await prisma.processFolder.create({
            data: {
                folderCode: rootFolderCode,
                description: title || `Pasta ${rootFolderCode}`
            }
        });

        return newFolder.id;

    } catch (error) {
        console.error(`[FOLDER] Erro ao processar pasta ${rootFolderCode}:`, error);
        // Em caso de erro de concorrência (ex: dois processos tentando criar a mesma pasta ao mesmo tempo),
        // tentamos buscar novamente como fallback.
        const retryFolder = await prisma.processFolder.findUnique({
            where: { folderCode: rootFolderCode }
        });
        return retryFolder?.id || null;
    }
};