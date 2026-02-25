import { Request, Response } from 'express';
import { AdminDeleteUserDocumentUseCase } from './AdminDeleteUserDocumentUseCase';

class AdminDeleteUserDocumentController {
    handle = async (request: Request, response: Response): Promise<Response> => {
        const id = request.params.id as string;
        const { url } = request.body; 

        if (!url) {
            return response.status(400).json({ error: "A URL do documento é obrigatória." });
        }

        const useCase = new AdminDeleteUserDocumentUseCase();

        try {
            await useCase.execute({ userId: id, documentUrl: url });
            return response.status(204).send();
        } catch (err: any) {
            return response.status(500).json({ error: err.message });
        }
    }
}

export { AdminDeleteUserDocumentController };