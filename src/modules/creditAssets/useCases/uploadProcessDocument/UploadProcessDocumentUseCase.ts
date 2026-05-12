import { prisma } from '../../../../prisma';
import { fileUploadService } from '../../../../services/fileUploadService';

interface IRequest {
    legalOneId: number;
    file: Express.Multer.File;
    section: string;
    category: string;
    auth0UserId: string;
    investorUserId?: string;
}

const VALID_SECTIONS = ['JURIDICO', 'PRIVADO_FINANCEIRO', 'PROCESSUAL'];

const VALID_CATEGORIES: Record<string, string[]> = {
    JURIDICO: ['TERMO_CESSAO', 'PROCURACAO', 'OUTRO_JURIDICO'],
    PRIVADO_FINANCEIRO: ['CESSAO', 'HONORARIOS', 'ORIENTACAO_FINANCEIRA', 'ORIENTACAO_FISCAL', 'COMPROVANTE', 'NOTA_FISCAL'],
    PROCESSUAL: ['SENTENCA', 'DESPACHO', 'OUTRO_PROCESSUAL'],
};

class UploadProcessDocumentUseCase {
    async execute({ legalOneId, file, section, category, auth0UserId, investorUserId }: IRequest) {
        if (!VALID_SECTIONS.includes(section)) {
            throw new Error(`Seção inválida: ${section}`);
        }
        if (!VALID_CATEGORIES[section]?.includes(category)) {
            throw new Error(`Categoria inválida "${category}" para a seção "${section}"`);
        }

        const asset = await prisma.creditAsset.findUnique({ where: { legalOneId } });
        if (!asset) throw new Error('Processo não encontrado.');

        const uploader = await prisma.user.findUniqueOrThrow({ where: { auth0UserId }, select: { id: true } });

        const folder = `assets/${asset.id}/documents`;
        const fileContent = file.buffer || file.path;
        const fileUrl = await fileUploadService.upload(fileContent, file.originalname, folder, file.mimetype);
        const fileKey = new URL(fileUrl).pathname.substring(1);

        // PRIVADO_FINANCEIRO docs devem ter investorUserId
        if (section === 'PRIVADO_FINANCEIRO' && !investorUserId) {
            throw new Error('investorUserId é obrigatório para documentos Privados e Financeiros.');
        }

        const doc = await prisma.document.create({
            data: {
                name: file.originalname,
                url: fileUrl,
                fileKey,
                mimeType: file.mimetype,
                section,
                category,
                sourceType: 'MANUAL',
                uploadedByUserId: uploader.id,
                assetId: asset.id,
                investorUserId: investorUserId || null,
            },
        });

        return doc;
    }
}

export { UploadProcessDocumentUseCase };
