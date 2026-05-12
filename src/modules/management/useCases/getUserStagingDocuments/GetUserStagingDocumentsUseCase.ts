import { prisma } from '../../../../prisma';

class GetUserStagingDocumentsUseCase {
    async execute(userId: string) {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } });
        if (!user) throw new Error('Usuário não encontrado.');

        const docs = await prisma.userStagingDocument.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });

        return { user, docs };
    }
}

export { GetUserStagingDocumentsUseCase };
