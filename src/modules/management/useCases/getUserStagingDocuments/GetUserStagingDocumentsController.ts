import { Request, Response } from 'express';
import { GetUserStagingDocumentsUseCase } from './GetUserStagingDocumentsUseCase';

class GetUserStagingDocumentsController {
    async handle(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const useCase = new GetUserStagingDocumentsUseCase();
            const result = await useCase.execute(id);
            return res.status(200).json(result);
        } catch (error: any) {
            return res.status(400).json({ error: error.message });
        }
    }
}

export { GetUserStagingDocumentsController };
