import { Request, Response } from 'express';
import { UploadStagingDocumentUseCase } from './UploadStagingDocumentUseCase';

class UploadStagingDocumentController {
    async handle(req: Request, res: Response) {
        try {
            const auth0UserId = (req as any).auth?.payload?.sub;
            const file = req.file;
            if (!file) return res.status(400).json({ error: 'Arquivo obrigatório.' });

            const useCase = new UploadStagingDocumentUseCase();
            const doc = await useCase.execute({ auth0UserId, file });
            return res.status(201).json(doc);
        } catch (error: any) {
            return res.status(400).json({ error: error.message });
        }
    }
}

export { UploadStagingDocumentController };
