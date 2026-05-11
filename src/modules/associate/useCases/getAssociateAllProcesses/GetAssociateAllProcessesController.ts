import { Request, Response } from 'express';
import { GetAssociateAllProcessesUseCase } from './GetAssociateAllProcessesUseCase';

class GetAssociateAllProcessesController {
    handle = async (request: Request, response: Response): Promise<Response> => {
        const auth0UserId = request.auth?.payload?.sub as string;
        if (!auth0UserId) return response.status(401).json({ error: 'Não autorizado.' });

        try {
            const useCase = new GetAssociateAllProcessesUseCase();
            const rows = await useCase.execute(auth0UserId);
            return response.status(200).json(rows);
        } catch (err: any) {
            return response.status(400).json({ error: err.message });
        }
    };
}

export { GetAssociateAllProcessesController };
