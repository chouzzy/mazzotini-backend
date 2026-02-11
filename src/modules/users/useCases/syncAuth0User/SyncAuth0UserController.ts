import { Request, Response } from 'express';
import { SyncAuth0UserUseCase } from './SyncAuth0UserUseCase';

class SyncAuth0UserController {
    async handle(request: Request, response: Response): Promise<Response> {
        // 1. O ID (sub) continua vindo do Token para garantir a segurança da sessão
        const userClaims = (request as any).auth.payload;
        const auth0UserId = userClaims.sub;

        // 2. CORREÇÃO: Os dados cadastrais vêm do corpo da requisição (enviados pelo front)
        const { email, name, picture } = request.body;

        console.log(`[SYNC AUTH0] Iniciando sync para ID: ${auth0UserId}`);
        console.log(`[SYNC AUTH0] Dados recebidos: Email=${email}, Nome=${name}`);

        if (!email) {
            return response.status(400).json({ error: "E-mail é obrigatório para sincronização." });
        }

        const useCase = new SyncAuth0UserUseCase();

        try {
            const user = await useCase.execute({
                auth0UserId,
                email,
                name: name || email, // Fallback se não tiver nome
                picture: picture || ''
            });
            return response.status(200).json(user);
        } catch (err: any) {
            console.error("[SYNC AUTH0] Erro:", err.message);
            return response.status(500).json({ error: "Falha ao sincronizar usuário." });
        }
    }
}

export { SyncAuth0UserController };