// /src/modules/users/useCases/getMyProfile/GetMyProfileController.ts
import { Request, Response } from 'express';
import { GetMyProfileUseCase } from './GetMyProfileUseCase';

interface CustomJWTPayload {
    sub: string;
}

class GetMyProfileController {
    async handle(request: Request, response: Response): Promise<Response> {
        const payload = (request as any).auth.payload as CustomJWTPayload;
        const auth0UserId = payload.sub;

        const useCase = new GetMyProfileUseCase();
        try {
            const user = await useCase.execute(auth0UserId);
            if (!user) {
                return response.status(404).json({ error: "Utilizador não encontrado na base de dados local." });
            }
            return response.status(200).json(user);
        } catch (err: any) {
            console.error("[PROFILE] Erro ao buscar perfil:", err.message);
            return response.status(500).json({ error: 'Erro interno ao buscar o perfil.' });
        }
    }
}

export { GetMyProfileController };
