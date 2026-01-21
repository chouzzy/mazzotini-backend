import { PrismaClient } from "@prisma/client";
import { fileUploadService } from "../../../../services/fileUploadService";
import { legalOneApiService } from "../../../../services/legalOneApiService"; // Importar serviço

const prisma = new PrismaClient();

interface IRequest {
    auth0UserId: string;
    file: Express.Multer.File;
}

class UploadPersonalDocumentUseCase {
    async execute({ auth0UserId, file }: IRequest): Promise<string> {
        // Busca usuário e o ID do contato Legal One (se existir)
        const user = await prisma.user.findUniqueOrThrow({ 
            where: { auth0UserId }, 
            select: { id: true, legalOneContactId: true } 
        });

        console.log(`[UPLOAD] Processando documento '${file.originalname}' para User ID: ${user.id}`);

        // 1. Upload para o nosso Storage (Spaces/S3)
        const folder = `users/${user.id}/documents`;
        // Nota: Se usar diskStorage, use file.path. Se memory, use file.buffer.
        // O fileUploadService que fiz suporta ambos.
        const fileContent = file.path || file.buffer;
        
        const fileUrl = await fileUploadService.upload(fileContent, file.originalname, folder, file.mimetype);

        // 2. Atualiza banco de dados local
        await prisma.user.update({
            where: { auth0UserId },
            data: { 
                personalDocumentUrls: {
                    push: fileUrl
                }
            },
        });

        // 3. REPLICAÇÃO NO LEGAL ONE (Se o usuário já estiver vinculado)
        if (user.legalOneContactId) {
            console.log(`[UPLOAD] Replicando documento para o GED do Legal One (Contact ID: ${user.legalOneContactId})...`);
            try {
                // a. Pega a extensão real
                const extension = file.originalname.split('.').pop() || 'pdf';
                
                // b. Pede o container
                const container = await legalOneApiService.getUploadContainer(extension);
                
                // c. Envia o arquivo físico (Buffer necessário aqui)
                // Se estiver usando diskStorage, precisamos ler o arquivo.
                // Mas geralmente memoryStorage é mais fácil para replicação direta.
                // Assumindo que file.buffer está disponível ou lendo do path:
                let bufferToSend = file.buffer;
                if (!bufferToSend && file.path) {
                    const fs = require('fs');
                    bufferToSend = fs.readFileSync(file.path);
                }

                await legalOneApiService.uploadFileToContainer(container.externalId, bufferToSend, file.mimetype);
                
                // d. Finaliza e vincula ao contato
                await legalOneApiService.finalizeDocument(container.fileName, file.originalname, user.legalOneContactId);
                
                console.log(`[UPLOAD] Documento replicado com sucesso no Legal One.`);
            } catch (error: any) {
                // Não paramos o fluxo se falhar no Legal One, apenas logamos
                console.error(`[UPLOAD] Falha ao replicar no Legal One:`, error.message);
            }
        }

        return fileUrl;
    }
}
export { UploadPersonalDocumentUseCase };