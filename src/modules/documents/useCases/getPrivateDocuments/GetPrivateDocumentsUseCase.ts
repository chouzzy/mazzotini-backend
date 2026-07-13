import { prisma } from '../../../../prisma';

export class GetPrivateDocumentsUseCase {
    async execute(auth0UserId: string) {
        const user = await prisma.user.findUniqueOrThrow({
            where: { auth0UserId },
            select: { id: true },
        });

        return prisma.document.findMany({
            where: {
                investorUserId: user.id,
                section: 'PRIVADO_FINANCEIRO',
            },
            orderBy: { createdAt: 'desc' },
        });
    }
}
