import { PrismaClient } from "@prisma/client";
import { fileUploadService } from "../../../../services/fileUploadService"; // Agora importado

const prisma = new PrismaClient();

interface IRequest {
    auth0UserId: string;
    documentUrl: string;
}

class DeletePersonalDocumentUseCase {
    async execute({ auth0UserId, documentUrl }: IRequest): Promise<void> {
        console.log(`[DELETE DOC] Solicitando exclusão do documento: ${documentUrl}`);

        // 1. Busca o usuário para pegar a lista atual
        const user = await prisma.user.findUnique({
            where: { auth0UserId },
            select: { id: true, personalDocumentUrls: true }
        });

        if (!user) {
            throw new Error("Usuário não encontrado.");
        }

        // 2. Apaga o arquivo físico no Spaces (S3)
        // Fazemos isso antes ou em paralelo ao banco. Se falhar, o log avisa.
        await fileUploadService.deleteFile(documentUrl);

        // 3. Filtra a lista removendo a URL específica
        const updatedUrls = user.personalDocumentUrls.filter(url => url !== documentUrl);

        // 4. Atualiza o banco de dados com a nova lista
        await prisma.user.update({
            where: { id: user.id },
            data: {
                personalDocumentUrls: updatedUrls
            }
        });

        console.log(`[DELETE DOC] Documento removido do perfil do usuário ${user.id}.`);
    }
}

export { DeletePersonalDocumentUseCase };