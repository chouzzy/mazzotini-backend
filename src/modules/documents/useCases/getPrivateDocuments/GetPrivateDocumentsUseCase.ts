import { prisma } from '../../../../prisma';
import { isApprovedAccount } from '../../../../utils/accountStatus';

/** Cadastro aprovado (ou antigo, sem status): só ele vê os documentos privados. */
export const canSeePrivateDocuments = isApprovedAccount;

export class GetPrivateDocumentsUseCase {
    async execute(auth0UserId: string) {
        const user = await prisma.user.findUniqueOrThrow({
            where: { auth0UserId },
            select: { id: true, status: true },
        });
        // Cadastro ainda em análise: os documentos aparecem depois da aprovação
        if (!canSeePrivateDocuments(user.status)) return [];

        return prisma.document.findMany({
            where: {
                investorUserId: user.id,
                section: 'PRIVADO_FINANCEIRO',
            },
            orderBy: { createdAt: 'desc' },
        });
    }
}
