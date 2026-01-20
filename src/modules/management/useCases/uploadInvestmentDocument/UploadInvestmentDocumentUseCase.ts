import { PrismaClient } from "@prisma/client";
import { fileUploadService } from "../../../../services/fileUploadService";

const prisma = new PrismaClient();

interface IRequest {
    userId: string;
    file: Express.Multer.File;
}

class UploadInvestmentDocumentUseCase {
    async execute({ userId, file }: IRequest): Promise<string> {
        // Apenas verifica se o usuário existe para garantir a pasta correta
        const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true } });

        console.log(`[UPLOAD INV] Upload de documento de investimento para user: ${user.id}`);

        const folder = `users/${user.id}/investments/documents`;
        const fileUrl = await fileUploadService.upload(file.buffer, file.originalname, folder, file.mimetype);

        return fileUrl;
    }
}
export { UploadInvestmentDocumentUseCase };