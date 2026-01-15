import { Request, Response } from 'express';
import { DeletePersonalDocumentUseCase } from './DeletePersonalDocumentUseCase';

interface CustomJWTPayload {
    sub: string;
}

class DeletePersonalDocumentController {
    async handle(request: Request, response: Response): Promise<Response> {
        const { sub: auth0UserId } = (request as any).auth.payload as CustomJWTPayload;
        const { url } = request.body; // Espera { "url": "https://..." }

        if (!url) {
            return response.status(400).json({ error: "A URL do documento é obrigatória." });
        }

        const useCase = new DeletePersonalDocumentUseCase();

        try {
            await useCase.execute({ auth0UserId, documentUrl: url });
            return response.status(204).send(); // Sucesso sem conteúdo
        } catch (err: any) {
            console.error("[DELETE DOC] Erro:", err.message);
            return response.status(500).json({ error: err.message });
        }
    }
}

export { DeletePersonalDocumentController };