import { prisma } from '../../../../prisma';

class ListStagingDocumentsUseCase {
    async execute(auth0UserId: string) {
        const user = await prisma.user.findUniqueOrThrow({ where: { auth0UserId }, select: { id: true } });

        return prisma.userStagingDocument.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' },
        });
    }
}

export { ListStagingDocumentsUseCase };
