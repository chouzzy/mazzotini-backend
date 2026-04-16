import { Request, Response } from 'express';
import { UpdateUserEmailUseCase } from './UpdateUserEmailUseCase';
import { AppError } from '../../../../errors/AppError';

class UpdateUserEmailController {
    async handle(request: Request, response: Response): Promise<Response> {
        const { auth0UserId } = request.params;
        const { newEmail } = request.body;

        if (!newEmail || typeof newEmail !== 'string') {
            return response.status(400).json({ error: 'O campo "newEmail" é obrigatório.' });
        }

        try {
            const useCase = new UpdateUserEmailUseCase();
            await useCase.execute(auth0UserId, newEmail.trim().toLowerCase());
            return response.status(204).send();
        } catch (err: any) {
            if (err instanceof AppError) {
                return response.status(err.statusCode).json({ error: err.message });
            }
            console.error(`[UPDATE EMAIL] Erro:`, err.message);
            return response.status(500).json({ error: err.message });
        }
    }
}

export { UpdateUserEmailController };
