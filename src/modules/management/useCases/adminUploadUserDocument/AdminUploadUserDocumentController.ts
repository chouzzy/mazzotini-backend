import { Request, Response } from 'express';
import { AdminUploadUserDocumentUseCase } from './AdminUploadUserDocumentUseCase';
import { AppError } from '../../../../errors/AppError';

class AdminUploadUserDocumentController {
    async handle(request: Request, response: Response): Promise<Response> {
        const id = request.params.id as string; // ID do Usuário alvo
        const file = request.file;

        if (!file) {
            return response.status(400).json({ error: "Arquivo obrigatório." });
        }

        const useCase = new AdminUploadUserDocumentUseCase();
        try {
            const url = await useCase.execute({ userId: id, file });
            return response.status(201).json({ url });
        } catch (err: any) {
            // Tipo ou tamanho do arquivo recusado (415/413) não é erro do servidor
            const status = err instanceof AppError ? err.statusCode : 500;
            if (status >= 500) console.error('[ADMIN UPLOAD] Erro ao enviar documento:', err.message);
            return response.status(status).json({ error: err.message });
        }
    }
}
export { AdminUploadUserDocumentController };