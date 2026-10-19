import { Request, Response } from 'express';
import { SyncAuth0UserUseCase } from './SyncAuth0UserUseCase';
import { AppError } from '../../../../errors/AppError';

class SyncAuth0UserController {
    async handle(request: Request, response: Response): Promise<Response> {
        // 1. O ID (sub) vem do Token para garantir a segurança da sessão
        const userClaims = (request as any).auth.payload;
        const auth0UserId = userClaims.sub;

        // 2. Nome e foto do corpo servem só de reserva. O e-mail enviado pelo front
        //    é ignorado: o use case busca o e-mail (e se foi verificado) no Auth0.
        const { name, picture } = request.body ?? {};

        console.log(`[SYNC AUTH0] Iniciando sync para ID: ${auth0UserId}`);

        const useCase = new SyncAuth0UserUseCase();

        try {
            const user = await useCase.execute({ auth0UserId, name, picture });
            return response.status(200).json(user);
        } catch (err: any) {
            if (err instanceof AppError) {
                return response.status(err.statusCode).json({ error: err.message, code: err.code });
            }
            console.error("[SYNC AUTH0] Erro:", err.message);
            return response.status(500).json({ error: "Falha ao sincronizar usuário." });
        }
    }
}

export { SyncAuth0UserController };
