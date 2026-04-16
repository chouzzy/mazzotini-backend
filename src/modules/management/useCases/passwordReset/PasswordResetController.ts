import { Request, Response } from 'express';
import { PasswordResetUseCase } from './PasswordResetUseCase';

class PasswordResetController {
    async handle(request: Request, response: Response): Promise<Response> {
        const { auth0UserId } = request.params;
        try {
            const useCase = new PasswordResetUseCase();
            const resetLink = await useCase.execute(auth0UserId);
            return response.status(200).json({ resetLink });
        } catch (err: any) {
            console.error(`[PASSWORD RESET] Erro:`, err.message);
            return response.status(500).json({ error: err.message });
        }
    }
}

export { PasswordResetController };
