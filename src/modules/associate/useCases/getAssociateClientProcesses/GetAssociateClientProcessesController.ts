import { Request, Response } from 'express';
import { GetAssociateClientProcessesUseCase } from './GetAssociateClientProcessesUseCase';

class GetAssociateClientProcessesController {
    handle = async (request: Request, response: Response): Promise<Response> => {
        const auth0UserId = request.auth?.payload?.sub as string;
        const { clientId } = request.params;

        if (!auth0UserId) return response.status(401).json({ error: 'Não autorizado.' });

        try {
            const useCase = new GetAssociateClientProcessesUseCase();
            const result = await useCase.execute(auth0UserId, clientId);
            return response.status(200).json(result);
        } catch (err: any) {
            return response.status(400).json({ error: err.message });
        }
    };
}

export { GetAssociateClientProcessesController };
