import { Request, Response } from 'express';
import { UploadProcessDocumentUseCase } from './UploadProcessDocumentUseCase';

class UploadProcessDocumentController {
    async handle(req: Request, res: Response) {
        try {
            const legalOneId = parseInt(req.params.legalOneId, 10);
            const { section, category, investorUserId } = req.body;
            const file = req.file;
            const auth0UserId = (req as any).auth?.payload?.sub;

            if (!file) return res.status(400).json({ error: 'Arquivo obrigatório.' });
            if (!section || !category) return res.status(400).json({ error: 'Seção e categoria são obrigatórias.' });

            const useCase = new UploadProcessDocumentUseCase();
            const doc = await useCase.execute({ legalOneId, file, section, category, auth0UserId, investorUserId });

            return res.status(201).json(doc);
        } catch (error: any) {
            return res.status(400).json({ error: error.message });
        }
    }
}

export { UploadProcessDocumentController };
