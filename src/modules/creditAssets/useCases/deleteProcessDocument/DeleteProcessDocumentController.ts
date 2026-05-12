import { Request, Response } from 'express';
import { DeleteProcessDocumentUseCase } from './DeleteProcessDocumentUseCase';

class DeleteProcessDocumentController {
    async handle(req: Request, res: Response) {
        try {
            const { documentId } = req.params;
            const useCase = new DeleteProcessDocumentUseCase();
            await useCase.execute(documentId);
            return res.status(200).json({ message: 'Documento removido com sucesso.' });
        } catch (error: any) {
            return res.status(400).json({ error: error.message });
        }
    }
}

export { DeleteProcessDocumentController };
