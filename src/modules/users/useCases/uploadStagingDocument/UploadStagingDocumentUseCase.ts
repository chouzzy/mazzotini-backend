import { prisma } from '../../../../prisma';
import { fileUploadService } from '../../../../services/fileUploadService';

interface IRequest {
    auth0UserId: string;
    file: Express.Multer.File;
}

class UploadStagingDocumentUseCase {
    async execute({ auth0UserId, file }: IRequest) {
        const user = await prisma.user.findUniqueOrThrow({ where: { auth0UserId }, select: { id: true } });

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
                status: 'PENDING',
            },
        });

        return doc;
    }
}

export { UploadStagingDocumentUseCase };
