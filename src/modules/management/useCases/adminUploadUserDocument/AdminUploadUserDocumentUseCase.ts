import { PrismaClient } from "@prisma/client";
import { fileUploadService } from "../../../../services/fileUploadService";
import { legalOneApiService } from "../../../../services/legalOneApiService";

const prisma = new PrismaClient();

interface IRequest {
    userId: string; // ID do Prisma
    file: Express.Multer.File;
}

class AdminUploadUserDocumentUseCase {
    async execute({ userId, file }: IRequest): Promise<string> {
        // Busca usuário
        console.log(`[ADMIN UPLOAD DEBUG] Buscando usuário com ID: ${userId}`);
        const user = await prisma.user.findUniqueOrThrow({ 
            where: { id: userId },
            select: { id: true, legalOneContactId: true }
        });
        console.log(`[ADMIN UPLOAD DEBUG] Usuário encontrado:`, user);

        console.log(`[ADMIN UPLOAD] Enviando documento '${file.originalname}' para User: ${userId}`);

        // 1. Storage Local
        const folder = `users/${userId}/documents`;
        const fileContent = file.path || file.buffer;
        const fileUrl = await fileUploadService.upload(fileContent, file.originalname, folder, file.mimetype);

        // 2. Banco Local
        await prisma.user.update({
            where: { id: userId },
            data: { 
                personalDocumentUrls: { push: fileUrl }
            },
        });

        // 3. REPLICAÇÃO LEGAL ONE
        if (user.legalOneContactId) {
            console.log(`[ADMIN UPLOAD] Replicando para Legal One ID: ${user.legalOneContactId}`);
            try {
            const extension = file.originalname.split('.').pop() || 'pdf';
            console.log(`[ADMIN UPLOAD DEBUG] File extension: ${extension}`);

            const container = await legalOneApiService.getUploadContainer(extension);
            console.log(`[ADMIN UPLOAD DEBUG] Got upload container:`, container);
            
            let bufferToSend = file.buffer;
            if (!bufferToSend && file.path) {
                console.log(`[ADMIN UPLOAD DEBUG] Reading file from path: ${file.path}`);
                const fs = require('fs');
                bufferToSend = fs.readFileSync(file.path);
            } else {
                console.log(`[ADMIN UPLOAD DEBUG] Using file buffer directly.`);
            }
            console.log(`[ADMIN UPLOAD DEBUG] Buffer size: ${bufferToSend ? bufferToSend.length : 'N/A'}`);

            console.log(`[ADMIN UPLOAD DEBUG] Uploading to container externalId: ${container.externalId} with mimetype: ${file.mimetype}`);
            await legalOneApiService.uploadFileToContainer(container.externalId, bufferToSend, file.mimetype);
            
            console.log(`[ADMIN UPLOAD DEBUG] Finalizing document with fileName: ${container.fileName}, originalname: ${file.originalname}, contactId: ${user.legalOneContactId}`);
            await legalOneApiService.finalizeDocument(container.fileName, file.originalname, user.legalOneContactId);
            
            console.log(`[ADMIN UPLOAD] Sucesso na replicação.`);
            } catch (error: any) {
            console.error(`[ADMIN UPLOAD] Falha na replicação:`, error.message);
            console.error(`[ADMIN UPLOAD DEBUG] Full error object:`, error);
            }
        }

        return fileUrl;
    }
}
export { AdminUploadUserDocumentUseCase };