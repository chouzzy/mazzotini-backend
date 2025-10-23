// /src/modules/users/useCases/uploadPersonalDocument/UploadPersonalDocumentUseCase.ts
import { PrismaClient } from "@prisma/client";
import { fileUploadService } from "../../../../services/fileUploadService";

const prisma = new PrismaClient();

interface IRequest {
    auth0UserId: string;
    file: Express.Multer.File;
}

class UploadPersonalDocumentUseCase {
    async execute({ auth0UserId, file }: IRequest): Promise<string> {
        const user = await prisma.user.findUniqueOrThrow({ where: { auth0UserId }, select: { id: true } });

        console.log(`[UPLOAD] A processar upload do documento '${file.originalname}' para: ${user.id}`);

        const folder = `users/${user.id}/documents`;
        const fileUrl = await fileUploadService.upload(file.buffer, file.originalname, folder, file.mimetype);

        await prisma.user.update({
            where: { auth0UserId },
            data: { 
                personalDocumentUrls: {
                    push: fileUrl // Adiciona a nova URL ao array de documentos
                }
            },
        });
        return fileUrl;
    }
}
export { UploadPersonalDocumentUseCase };
