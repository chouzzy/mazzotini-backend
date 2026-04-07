import fs from 'fs';
import { PrismaClient } from "@prisma/client";
import { fileUploadService } from "../../../../services/fileUploadService";
import { legalOneApiService } from "../../../../services/legalOneApiService";
import { AppError } from "../../../../errors/AppError";

const ALLOWED_MIME_TYPES = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
]);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const prisma = new PrismaClient();

interface IRequest {
    userId: string; // ID do Prisma
    file: Express.Multer.File;
}

class AdminUploadUserDocumentUseCase {
    async execute({ userId, file }: IRequest): Promise<string> {
        // Validação de tipo e tamanho
        if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
            throw new AppError(`Tipo de arquivo não permitido: ${file.mimetype}. Envie PDF, JPEG, PNG ou WEBP.`, 415);
        }
        if (file.size > MAX_FILE_SIZE_BYTES) {
            throw new AppError(`Arquivo muito grande. Tamanho máximo permitido: 10 MB.`, 413);
        }

        const user = await prisma.user.findUniqueOrThrow({
            where: { id: userId },
            select: { id: true, legalOneContactId: true }
        });

        console.log(`[ADMIN UPLOAD] Enviando documento '${file.originalname}' para User: ${userId}`);

        // 1. Storage
        const folder = `users/${userId}/documents`;
        const fileContent = file.path || file.buffer;
        const fileUrl = await fileUploadService.upload(fileContent, file.originalname, folder, file.mimetype);

        // 2. Banco local
        await prisma.user.update({
            where: { id: userId },
            data: { personalDocumentUrls: { push: fileUrl } },
        });

        // 3. Replicação Legal One
        if (user.legalOneContactId) {
            console.log(`[ADMIN UPLOAD] Replicando para Legal One ID: ${user.legalOneContactId}`);
            try {
                const extension = file.originalname.split('.').pop() || 'pdf';
                const container = await legalOneApiService.getUploadContainer(extension);

                const bufferToSend: Buffer = file.buffer ?? fs.readFileSync(file.path);

                await legalOneApiService.uploadFileToContainer(container.externalId, bufferToSend, file.mimetype);
                await legalOneApiService.finalizeDocument(container.fileName, file.originalname, user.legalOneContactId);

                console.log(`[ADMIN UPLOAD] Documento '${file.originalname}' replicado com sucesso.`);
            } catch (error: any) {
                console.error(`[ADMIN UPLOAD] Falha na replicação para o Legal One:`, error.message);
            }
        }

        return fileUrl;
    }
}
export { AdminUploadUserDocumentUseCase };