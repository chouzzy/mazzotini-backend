// /src/modules/users/useCases/uploadPersonalDocument/UploadPersonalDocumentController.ts
import { Request, Response } from 'express';
import { UploadPersonalDocumentUseCase } from './UploadPersonalDocumentUseCase';

interface CustomJWTPayload {
    sub: string; // auth0UserId
}

class UploadPersonalDocumentController {
    async handle(request: Request, response: Response): Promise<Response> {
        const { sub: auth0UserId } = (request as any).auth.payload as CustomJWTPayload;
        const file = request.file;

        if (!file) {
            return response.status(400).json({ error: "Nenhum ficheiro 'document' foi enviado." });
        }
        
        const useCase = new UploadPersonalDocumentUseCase();
        try {
            const url = await useCase.execute({ auth0UserId, file });
            // Retorna a URL para o frontend
            return response.status(201).json({ url });
        } catch (err: any) {
            console.error("[PERSONAL DOCUMENT] Erro ao fazer upload:", err.message);
            return response.status(500).json({ error: err.message });
        }
    }
}
export { UploadPersonalDocumentController };
