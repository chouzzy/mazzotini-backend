// /src/modules/users/useCases/uploadProfilePicture/UploadProfilePictureController.ts
import { Request, Response } from 'express';
import { UploadProfilePictureUseCase } from './UploadProfilePictureUseCase';

interface CustomJWTPayload {
    sub: string; // auth0UserId
}

class UploadProfilePictureController {
    async handle(request: Request, response: Response): Promise<Response> {
        const { sub: auth0UserId } = (request as any).auth.payload as CustomJWTPayload;
        const file = request.file;

        if (!file) {
            return response.status(400).json({ error: "Nenhum ficheiro 'profilePicture' foi enviado." });
        }

        const useCase = new UploadProfilePictureUseCase();
        try {
            const url = await useCase.execute({ auth0UserId, file });
            // Retorna a URL para o frontend
            return response.status(201).json({ url });
        } catch (err: any) {
            console.error("[PROFILE PICTURE] Erro ao fazer upload:", err.message);
            return response.status(500).json({ error: err.message });
        }
    }
}
export { UploadProfilePictureController };
