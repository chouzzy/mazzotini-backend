// /src/modules/documents/useCases/getDownloadUrl/GetDownloadUrlUseCase.ts
import { PrismaClient } from "@prisma/client";
import { legalOneApiService } from "../../../../services/legalOneApiService";

const prisma = new PrismaClient();

class GetDownloadUrlUseCase {
    async execute(documentId: string): Promise<string> {
        console.log(`[DOWNLOAD] Buscando documento com ID: ${documentId}`);

        const document = await prisma.document.findUnique({
            where: { id: documentId },
        });

        if (!document || !document.legalOneDocumentId) {
            throw new Error("Documento não encontrado ou não possui um ID do Legal One associado.");
        }

        console.log(`[DOWNLOAD] Gerando URL para o Legal One ID: ${document.legalOneDocumentId}`);
        // const downloadUrl = await legalOneApiService.getDocumentDownloadUrl(document.legalOneDocumentId);

        // return downloadUrl;
        return ''
    }
}

export { GetDownloadUrlUseCase };
