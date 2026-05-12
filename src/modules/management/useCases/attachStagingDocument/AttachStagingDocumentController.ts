import { Request, Response } from 'express';
import { AttachStagingDocumentUseCase } from './AttachStagingDocumentUseCase';

class AttachStagingDocumentController {
    async handle(req: Request, res: Response) {
        try {
            const { stagingDocId } = req.params;
            const { assetLegalOneId, section, category, investorUserId } = req.body;
            const auth0UserId = (req as any).auth?.payload?.sub;

            if (!assetLegalOneId || !section || !category) {
                return res.status(400).json({ error: 'assetLegalOneId, section e category são obrigatórios.' });
            }

            const useCase = new AttachStagingDocumentUseCase();
            const doc = await useCase.execute({
                stagingDocId,
                assetLegalOneId: parseInt(assetLegalOneId, 10),
                section,
                category,
                auth0UserId,
                investorUserId,
            });

            return res.status(201).json(doc);
        } catch (error: any) {
            return res.status(400).json({ error: error.message });
        }
    }
}

export { AttachStagingDocumentController };
