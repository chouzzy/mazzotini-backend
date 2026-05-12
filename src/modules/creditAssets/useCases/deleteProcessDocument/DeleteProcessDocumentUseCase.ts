import { prisma } from '../../../../prisma';
import { fileUploadService } from '../../../../services/fileUploadService';

class DeleteProcessDocumentUseCase {
    async execute(documentId: string) {
        const doc = await prisma.document.findUnique({ where: { id: documentId } });
        if (!doc) throw new Error('Documento não encontrado.');

        if (doc.fileKey) {
            await fileUploadService.deleteFile(doc.url);
        }

        await prisma.document.delete({ where: { id: documentId } });
    }
}

export { DeleteProcessDocumentUseCase };
