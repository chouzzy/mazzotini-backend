import { Request, Response } from 'express';
import { DeleteStagingDocumentUseCase } from './DeleteStagingDocumentUseCase';

class DeleteStagingDocumentController {
    async handle(req: Request, res: Response) {
        try {
            const auth0UserId = (req as any).auth?.payload?.sub;
            const { stagingDocId } = req.params;
            const useCase = new DeleteStagingDocumentUseCase();
            await useCase.execute(auth0UserId, stagingDocId);
            return res.status(200).json({ message: 'Documento removido.' });
        } catch (error: any) {
            return res.status(400).json({ error: error.message });
        }
    }
}

export { DeleteStagingDocumentController };
