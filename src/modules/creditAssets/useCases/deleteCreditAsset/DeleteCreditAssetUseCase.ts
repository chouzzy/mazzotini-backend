import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

class DeleteCreditAssetUseCase {
    async execute(assetId: string): Promise<void> {
        console.log(`[DELETE ASSET] Iniciando exclusão completa do ativo: ${assetId}`);

        // Verifica se existe
        const asset = await prisma.creditAsset.findUnique({
            where: { id: assetId }
        });

        if (!asset) {
            throw new Error("Ativo não encontrado.");
        }

        // Executa em transação para garantir que não sobram "restos" se der erro no meio
        await prisma.$transaction(async (tx) => {
            
            // 1. Apagar Documentos vinculados
            const deletedDocs = await tx.document.deleteMany({
                where: { assetId: assetId }
            });
            console.log(`[DELETE ASSET] ${deletedDocs.count} documentos removidos.`);

            // 2. Apagar Investimentos vinculados
            const deletedInvestments = await tx.investment.deleteMany({
                where: { creditAssetId: assetId }
            });
            console.log(`[DELETE ASSET] ${deletedInvestments.count} investimentos removidos.`);

            // 3. Apagar Andamentos/Updates vinculados
            const deletedUpdates = await tx.assetUpdate.deleteMany({
                where: { assetId: assetId }
            });
            console.log(`[DELETE ASSET] ${deletedUpdates.count} andamentos removidos.`);

            // 4. Finalmente, apagar o Ativo Principal
            await tx.creditAsset.delete({
                where: { id: assetId }
            });
            
            console.log(`[DELETE ASSET] Ativo principal removido com sucesso.`);
        });
    }
}

export { DeleteCreditAssetUseCase };