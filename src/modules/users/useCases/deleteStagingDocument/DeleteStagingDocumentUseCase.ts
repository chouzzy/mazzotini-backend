import { prisma } from '../../../../prisma';
import { fileUploadService } from '../../../../services/fileUploadService';

class DeleteStagingDocumentUseCase {
    async execute(auth0UserId: string, stagingDocId: string) {
        const user = await prisma.user.findUniqueOrThrow({ where: { auth0UserId }, select: { id: true } });

        const doc = await prisma.userStagingDocument.findUnique({ where: { id: stagingDocId } });
        if (!doc) throw new Error('Documento não encontrado.');
        if (doc.userId !== user.id) throw new Error('Acesso negado.');
        if (doc.status === 'ATTACHED') throw new Error('Este documento já foi anexado a um processo e não pode ser excluído.');

        await fileUploadService.deleteFile(doc.fileUrl);
        await prisma.userStagingDocument.delete({ where: { id: stagingDocId } });
    }
}

export { DeleteStagingDocumentUseCase };
