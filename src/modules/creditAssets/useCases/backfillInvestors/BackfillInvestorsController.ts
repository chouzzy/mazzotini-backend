import { Request, Response } from 'express';
import { BackfillInvestorsUseCase } from './BackfillInvestorsUseCase';

class BackfillInvestorsController {
    handle = async (request: Request, response: Response): Promise<Response> => {
        const useCase = new BackfillInvestorsUseCase();

        // Executa em background para não estourar o timeout HTTP
        useCase.execute()
            .then(result => console.log('[BACKFILL] Resultado final:', JSON.stringify(result)))
            .catch(err => console.error('[BACKFILL] Erro fatal:', err.message));

        return response.status(202).json({
            status: 'started',
            message: 'Backfill iniciado em background. Acompanhe o progresso nos logs do servidor.',
        });
    };
}

export { BackfillInvestorsController };
