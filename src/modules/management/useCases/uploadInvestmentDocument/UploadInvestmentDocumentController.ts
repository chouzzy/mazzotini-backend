import { Request, Response } from 'express';
import { UploadInvestmentDocumentUseCase } from './UploadInvestmentDocumentUseCase';

class UploadInvestmentDocumentController {
    async handle(request: Request, response: Response): Promise<Response> {
        const { id } = request.params; // ID do Usuário
        const file = request.file;

        if (!file) return response.status(400).json({ error: "Arquivo obrigatório." });

        const useCase = new UploadInvestmentDocumentUseCase();
        try {
            const url = await useCase.execute({ userId: id, file });
            return response.status(201).json({ url });
        } catch (err: any) {
            return response.status(500).json({ error: err.message });
        }
    }
}
export { UploadInvestmentDocumentController };