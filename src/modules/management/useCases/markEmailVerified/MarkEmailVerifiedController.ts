import { Request, Response } from 'express';
import { MarkEmailVerifiedUseCase } from './MarkEmailVerifiedUseCase';

class MarkEmailVerifiedController {
    async handle(request: Request, response: Response): Promise<Response> {
        const { auth0UserId } = request.params;
        try {
            const useCase = new MarkEmailVerifiedUseCase();
            await useCase.execute(auth0UserId);
            return response.status(200).json({ message: 'E-mail marcado como verificado com sucesso.' });
        } catch (err: any) {
            console.error(`[MARK EMAIL VERIFIED] Erro:`, err.message);
            return response.status(500).json({ error: err.message });
        }
    }
}

export { MarkEmailVerifiedController };
