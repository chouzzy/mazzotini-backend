// /src/modules/users/useCases/uploadProfilePicture/UploadProfilePictureUseCase.ts
import { PrismaClient } from "@prisma/client";
import { fileUploadService } from "../../../../services/fileUploadService";


const prisma = new PrismaClient();

interface IRequest {
    auth0UserId: string;
    file: Express.Multer.File; // O ficheiro vem do Multer
}

class UploadProfilePictureUseCase {
    async execute({ auth0UserId, file }: IRequest): Promise<string> {
        // Busca o nosso utilizador interno para usar o ID como nome da pasta
        const user = await prisma.user.findUniqueOrThrow({ where: { auth0UserId }, select: { id: true } });
        
        console.log(`[UPLOAD] A processar upload de foto de perfil para: ${user.id}`);
        
        const folder = `users/${user.id}/profile_picture`;
        const fileUrl = await fileUploadService.upload(file.buffer, file.originalname, folder, file.mimetype);

        // Salva a URL no perfil do utilizador
        await prisma.user.update({
            where: { auth0UserId },
            data: { profilePictureUrl: fileUrl },
        });

        console.log(`[UPLOAD] Foto de perfil de ${user.id} atualizada com sucesso.`);
        return fileUrl;
    }
}
export { UploadProfilePictureUseCase };

