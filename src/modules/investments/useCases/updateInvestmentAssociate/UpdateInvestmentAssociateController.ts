import { Request, Response } from 'express';
import { UpdateInvestmentAssociateUseCase } from './UpdateInvestmentAssociateUseCase';

class UpdateInvestmentAssociateController {
    handle = async (request: Request, response: Response): Promise<Response> => {
        const auth0UserId = request.auth?.payload?.sub as string;
        const { investmentId } = request.params;
        const { associateId } = request.body;

        if (!auth0UserId) return response.status(401).json({ error: 'Não autorizado.' });

        try {
            const useCase = new UpdateInvestmentAssociateUseCase();
            await useCase.execute({
                auth0UserId,
                investmentId,
                associateId: associateId ?? null,
            });
            return response.status(200).json({ message: 'Associado atualizado com sucesso.' });
        } catch (err: any) {
            if (err.message === 'Acesso negado.') return response.status(403).json({ error: err.message });
            return response.status(400).json({ error: err.message });
        }
    };
}

export { UpdateInvestmentAssociateController };
