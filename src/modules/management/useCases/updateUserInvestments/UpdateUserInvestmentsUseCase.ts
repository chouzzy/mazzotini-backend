import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface InvestmentInput {
    assetId: string;
    share: number;
    documents?: string[]; // <-- NOVO: Array de URLs
}

interface IRequest {
    userId: string;
    investments: InvestmentInput[];
}

class UpdateUserInvestmentsUseCase {
    async execute({ userId, investments }: IRequest): Promise<void> {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new Error("Usuário não encontrado.");

        const assetIds = investments.map(i => i.assetId);
        const uniqueAssetIds = new Set(assetIds);
        if (uniqueAssetIds.size !== assetIds.length) {
            throw new Error("Não é permitido adicionar o mesmo processo duas vezes.");
        }

        await prisma.$transaction(async (tx) => {
            // Nuke
            await tx.investment.deleteMany({ where: { userId: userId } });

            // Pave (com documentos)
            if (investments.length > 0) {
                await tx.investment.createMany({
                    data: investments.map(inv => ({
                        userId: userId,
                        creditAssetId: inv.assetId,
                        investorShare: inv.share,
                        mazzotiniShare: 0,
                        documents: inv.documents || [] // <-- Salva os documentos
                    }))
                });
            }
        });
    }
}

export { UpdateUserInvestmentsUseCase };