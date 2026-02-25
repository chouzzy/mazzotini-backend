import { Request, Response } from 'express';
import { GetUserByIdUseCase } from './GetUserByIdUseCase';

class GetUserByIdController {
    handle = async (request: Request, response: Response): Promise<Response> => {
        const id = request.params.id as string;

        const useCase = new GetUserByIdUseCase();

        try {
            const user = await useCase.execute(id);
            return response.status(200).json(user);
        } catch (err: any) {
            return response.status(400).json({ error: err.message });
        }
    }
}

export { GetUserByIdController };