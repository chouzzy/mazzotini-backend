import { prisma } from '../../../../prisma';
import { fileUploadService } from '../../../../services/fileUploadService';
import { notifyAllAdmins } from '../../../../services/notificationService';

interface IRequest {
    auth0UserId: string;
    file: Express.Multer.File;
    category?: string;
}

class UploadStagingDocumentUseCase {
    async execute({ auth0UserId, file, category }: IRequest) {
        const user = await prisma.user.findUniqueOrThrow({ where: { auth0UserId }, select: { id: true, name: true } });

        const folder = `users/${user.id}/staging`;
        const fileContent = file.buffer || file.path;
        const fileUrl = await fileUploadService.upload(fileContent, file.originalname, folder, file.mimetype);
        const fileKey = new URL(fileUrl).pathname.substring(1);

        const doc = await prisma.userStagingDocument.create({
            data: {
                userId: user.id,
                fileName: file.originalname,
                fileUrl,
                fileKey,
                mimeType: file.mimetype,
                category: category || null,
                status: 'PENDING',
            },
        });

        await notifyAllAdmins({
            title: 'Novo documento enviado',
            message: `${user.name} enviou um novo documento financeiro${category ? ` (${category})` : ''}: "${file.originalname}". Acesse a área de gestão para analisar.`,
            type: 'warning',
            notificationType: 'STAGING_DOCUMENT_UPLOADED',
            relatedEntityId: user.id,
            relatedEntityType: 'User',
            relatedEntityName: user.name,
            link: `/gestao/usuarios/${user.id}`,
        });

        return doc;
    }
}

export { UploadStagingDocumentUseCase };
