import { Request, Response } from 'express';
import { ListPendingProfileChangesUseCase } from './ListPendingProfileChangesUseCase';

class ListPendingProfileChangesController {
    handle = async (_request: Request, response: Response): Promise<Response> => {
        try {
            const useCase = new ListPendingProfileChangesUseCase();
            const result = await useCase.execute();
            return response.status(200).json(result);
        } catch (err: any) {
            return response.status(500).json({ error: err.message });
        }
    };
}

export { ListPendingProfileChangesController };
