import { prisma } from '../../../../prisma';

const VALID_CATEGORIES: Record<string, string[]> = {
    JURIDICO: ['TERMO_CESSAO', 'PROCURACAO', 'OUTRO_JURIDICO'],
    PRIVADO_FINANCEIRO: ['CESSAO', 'HONORARIOS', 'ORIENTACAO_FINANCEIRA', 'ORIENTACAO_FISCAL', 'COMPROVANTE', 'NOTA_FISCAL'],
    PROCESSUAL: ['SENTENCA', 'DESPACHO', 'OUTRO_PROCESSUAL'],
};

interface IRequest {
    stagingDocId: string;
    assetLegalOneId: number;
    section: string;
    category: string;
    auth0UserId: string;
    investorUserId?: string;
}

class AttachStagingDocumentUseCase {
    async execute({ stagingDocId, assetLegalOneId, section, category, auth0UserId, investorUserId }: IRequest) {
        if (!VALID_CATEGORIES[section]?.includes(category)) {
            throw new Error(`Categoria inválida "${category}" para a seção "${section}"`);
        }
        const admin = await prisma.user.findUniqueOrThrow({ where: { auth0UserId }, select: { id: true } });
        const staging = await prisma.userStagingDocument.findUnique({ where: { id: stagingDocId } });
        if (!staging) throw new Error('Documento de staging não encontrado.');
        if (staging.status === 'ATTACHED') throw new Error('Este documento já foi anexado a um processo.');

        const asset = await prisma.creditAsset.findUnique({ where: { legalOneId: assetLegalOneId } });
        if (!asset) throw new Error('Processo não encontrado.');

        // Para PRIVADO_FINANCEIRO o investorUserId é o próprio dono do documento de staging
        const resolvedInvestorUserId = section === 'PRIVADO_FINANCEIRO'
            ? (investorUserId || staging.userId)
            : null;

        const doc = await prisma.document.create({
            data: {
                name: staging.fileName,
                url: staging.fileUrl,
                fileKey: staging.fileKey,
                mimeType: staging.mimeType,
                section,
                category,
                sourceType: 'CLIENTE',
                sourceStagingDocId: stagingDocId,
                uploadedByUserId: admin.id,
                assetId: asset.id,
                investorUserId: resolvedInvestorUserId,
            },
        });

        await prisma.userStagingDocument.update({
            where: { id: stagingDocId },
            data: {
                status: 'ATTACHED',
                attachedToAssetId: asset.id,
                attachedToAssetName: asset.processNumber,
                attachedCategory: category,
                attachedAt: new Date(),
                attachedByUserId: admin.id,
            },
        });

        return doc;
    }
}

export { AttachStagingDocumentUseCase };
