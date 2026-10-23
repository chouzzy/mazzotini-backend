import { prisma } from '../../../../prisma';




interface InvestmentInput {
    assetId: string;
    share: number;
    documents?: string[];
    associateId?: string | null;
}

interface IRequest {
    userId: string;
    investments: InvestmentInput[];
}

const OBJECT_ID = /^[a-f0-9]{24}$/i;

class UpdateUserInvestmentsUseCase {
    async execute({ userId, investments }: IRequest): Promise<void> {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new Error("Usuário não encontrado.");

        const assetIds = investments.map(i => i.assetId);
        const uniqueAssetIds = new Set(assetIds);
        if (uniqueAssetIds.size !== assetIds.length) {
            throw new Error("Não é permitido adicionar o mesmo processo duas vezes.");
        }
        if (assetIds.some(id => !OBJECT_ID.test(id))) throw new Error("Processo inválido na carteira.");
        if (investments.some(inv => inv.associateId && !OBJECT_ID.test(inv.associateId))) {
            throw new Error("Associado inválido na carteira.");
        }

        // Um processo excluído com a carteira aberta deixaria um investimento sem processo, e o
        // cadastro e o painel do cliente deixariam de abrir
        if (uniqueAssetIds.size > 0) {
            const found = await prisma.creditAsset.count({ where: { id: { in: [...uniqueAssetIds] } } });
            if (found !== uniqueAssetIds.size) {
                throw new Error("Um dos processos da carteira não existe mais. Recarregue a página e confira antes de salvar.");
            }
        }

        await prisma.$transaction(async (tx) => {
            // A carteira é regravada inteira; a data de aquisição de cada processo continua a mesma
            const previous = await tx.investment.findMany({
                where: { userId },
                select: { creditAssetId: true, acquisitionDate: true },
            });
            const acquisitionDates = new Map(previous.map(p => [p.creditAssetId, p.acquisitionDate]));

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
                        documents: inv.documents || [],
                        associateId: inv.associateId || null,
                        acquisitionDate: acquisitionDates.get(inv.assetId) ?? null,
                    }))
                });
            }
        });
    }
}

export { UpdateUserInvestmentsUseCase };
