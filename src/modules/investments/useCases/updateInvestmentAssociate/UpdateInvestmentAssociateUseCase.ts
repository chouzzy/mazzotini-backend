import { prisma } from '../../../../prisma';

interface IRequest {
    auth0UserId: string;
    investmentId: string;
    associateId: string | null;
}

class UpdateInvestmentAssociateUseCase {
    async execute({ auth0UserId, investmentId, associateId }: IRequest): Promise<void> {
        const user = await prisma.user.findUnique({
            where: { auth0UserId },
            select: { id: true },
        });
        if (!user) throw new Error('Usuário não encontrado.');

        const investment = await prisma.investment.findUnique({
            where: { id: investmentId },
            select: { id: true, userId: true },
        });
        if (!investment) throw new Error('Investimento não encontrado.');
        if (investment.userId !== user.id) throw new Error('Acesso negado.');

        if (associateId) {
            const associate = await prisma.user.findUnique({
                where: { id: associateId },
                select: { role: true },
            });
            if (!associate || associate.role !== 'ASSOCIATE') {
                throw new Error('O usuário selecionado não é um Associado.');
            }
        }

        await prisma.investment.update({
            where: { id: investmentId },
            data: { associateId: associateId ?? null },
        });
    }
}

export { UpdateInvestmentAssociateUseCase };
