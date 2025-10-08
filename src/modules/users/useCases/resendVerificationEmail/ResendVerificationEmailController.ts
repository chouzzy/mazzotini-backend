// /src/modules/users/useCases/resendVerificationEmail/ResendVerificationEmailController.ts
import { Request, Response } from 'express';
import { ResendVerificationEmailUseCase } from './ResendVerificationEmailUseCase';

interface CustomJWTPayload {
    sub: string;
}

class ResendVerificationEmailController {
    async handle(request: Request, response: Response): Promise<Response> {
        const payload = (request as any).auth.payload as CustomJWTPayload;
        const auth0UserId = payload.sub;
        const useCase = new ResendVerificationEmailUseCase();

        try {
            await useCase.execute(auth0UserId);
            return response.status(200).json({ message: "E-mail de verificação reenviado com sucesso." });
        } catch (err: any) {
            console.error("[RESEND VERIFICATION] Erro ao reenviar e-mail:", err.message);
            return response.status(500).json({ error: 'Erro interno ao tentar reenviar o e-mail.' });
        }
    }
}

export { ResendVerificationEmailController };
