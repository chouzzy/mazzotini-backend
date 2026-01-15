import { PrismaClient } from "@prisma/client";
import { fileUploadService } from "../../../../services/fileUploadService";

const prisma = new PrismaClient();

interface IRequest {
    userId: string;
    documentUrl: string;
}

class AdminDeleteUserDocumentUseCase {
    async execute({ userId, documentUrl }: IRequest): Promise<void> {
        console.log(`[ADMIN DELETE DOC] Excluindo documento de ${userId}: ${documentUrl}`);

        // 1. Busca o usuário
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, personalDocumentUrls: true }
        });

        if (!user) throw new Error("Usuário não encontrado.");

        // 2. Apaga o arquivo físico
        await fileUploadService.deleteFile(documentUrl);

        // 3. Atualiza o banco
        const updatedUrls = user.personalDocumentUrls.filter(url => url !== documentUrl);

        await prisma.user.update({
            where: { id: user.id },
            data: { personalDocumentUrls: updatedUrls }
        });

        console.log(`[ADMIN DELETE DOC] Sucesso.`);
    }
}

export { AdminDeleteUserDocumentUseCase };