// /src/modules/documents/useCases/getDownloadUrl/GetDownloadUrlUseCase.ts

import { prisma } from '../../../../prisma';
import { legalOneApiService } from "../../../../services/legalOneApiService";
import { canSeePrivateDocuments } from '../getPrivateDocuments/GetPrivateDocumentsUseCase';

class GetDownloadUrlUseCase {
    async execute(documentId: string, auth0UserId: string): Promise<string> {
        const document = await prisma.document.findUnique({
            where: { id: documentId },
        });

        if (!document || !document.legalOneDocumentId) {
            throw new Error("Documento não encontrado ou não possui um ID do Legal One associado.");
        }

        const user = await prisma.user.findUnique({
            where: { auth0UserId },
            select: { id: true, role: true, status: true },
        });

        if (!user) {
            throw new Error("Sem permissão para acessar este documento.");
        }

        const isPrivileged = user.role === 'ADMIN' || user.role === 'OPERATOR';

        if (!isPrivileged) {
            // Cadastro ainda em análise não baixa documentos
            if (!canSeePrivateDocuments(user.status)) {
                throw new Error("Sem permissão para acessar este documento.");
            }
            if (document.investorUserId) {
                if (document.investorUserId !== user.id) {
                    throw new Error("Sem permissão para acessar este documento.");
                }
            } else if (document.assetId) {
                const investment = await prisma.investment.findFirst({
                    where: { userId: user.id, creditAssetId: document.assetId },
                });
                if (!investment) {
                    throw new Error("Sem permissão para acessar este documento.");
                }
            } else {
                throw new Error("Sem permissão para acessar este documento.");
            }
        }

        const downloadUrl = await legalOneApiService.getDocumentDownloadUrl(document.legalOneDocumentId);
        return downloadUrl;
    }
}

export { GetDownloadUrlUseCase };
