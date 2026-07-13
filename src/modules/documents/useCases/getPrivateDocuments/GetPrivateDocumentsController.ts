import { Request, Response } from 'express';
import { GetPrivateDocumentsUseCase } from './GetPrivateDocumentsUseCase';

class GetPrivateDocumentsController {
    async handle(req: Request, res: Response) {
        try {
            const auth0UserId = (req as any).auth?.payload?.sub;
            const useCase = new GetPrivateDocumentsUseCase();
            const docs = await useCase.execute(auth0UserId);
            return res.status(200).json(docs);
        } catch (error: any) {
            return res.status(400).json({ error: error.message });
        }
    }
}

export { GetPrivateDocumentsController };
