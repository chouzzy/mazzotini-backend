import { Request, Response } from 'express';
import { UpdateAssociateCodeUseCase } from './UpdateAssociateCodeUseCase';

class UpdateAssociateCodeController {
    handle = async (request: Request, response: Response): Promise<Response> => {
        const { id } = request.params;
        const { associateSequence } = request.body;

        if (associateSequence !== null && associateSequence !== undefined) {
            if (!Number.isInteger(associateSequence) || associateSequence < 1 || associateSequence > 999) {
                return response.status(400).json({ error: 'Código inválido. Deve ser um número inteiro entre 1 e 999.' });
            }
        }

        try {
            const useCase = new UpdateAssociateCodeUseCase();
            await useCase.execute({ userId: id, associateSequence: associateSequence ?? null });
            return response.status(200).json({ message: 'Código do associado atualizado com sucesso.' });
        } catch (err: any) {
            return response.status(400).json({ error: err.message });
        }
    };
}

export { UpdateAssociateCodeController };
