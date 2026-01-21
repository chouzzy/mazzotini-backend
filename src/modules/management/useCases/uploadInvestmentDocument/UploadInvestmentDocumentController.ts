import { Request, Response } from 'express';
import { UploadInvestmentDocumentUseCase } from './UploadInvestmentDocumentUseCase';

class UploadInvestmentDocumentController {
    async handle(request: Request, response: Response): Promise<Response> {
        const { id } = request.params; // ID do Usuário (da rota)
        const file = request.file;
        
        // O assetId vem no corpo da requisição (multipart/form-data)
        // O Multer popula o request.body com os campos de texto
        const { assetId } = request.body; 

        if (!file) {
            return response.status(400).json({ error: "Arquivo obrigatório." });
        }

        const useCase = new UploadInvestmentDocumentUseCase();

        try {
            const url = await useCase.execute({ 
                userId: id, 
                file,
                assetId: assetId ? String(assetId) : undefined // Garante que seja string ou undefined
            });
            
            return response.status(201).json({ url });
        } catch (err: any) {
            console.error("[UPLOAD INV CONTROLLER] Erro:", err.message);
            return response.status(500).json({ error: err.message });
        }
    }
}
export { UploadInvestmentDocumentController };