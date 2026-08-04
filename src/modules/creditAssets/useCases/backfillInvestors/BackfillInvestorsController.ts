import { Request, Response } from 'express';
import { BackfillInvestorsUseCase } from './BackfillInvestorsUseCase';
import { getBackfillState, updateBackfillState } from './backfillState';

class BackfillInvestorsController {
    handle = async (request: Request, response: Response): Promise<Response> => {
        const current = getBackfillState();
        if (current.status === 'running') {
            return response.status(409).json({ status: 'running', message: 'Backfill já em andamento.' });
        }

        const useCase = new BackfillInvestorsUseCase();

        useCase.execute()
            .then(result => console.log('[BACKFILL] Resultado final:', JSON.stringify(result)))
            .catch(err => {
                console.error('[BACKFILL] Erro fatal:', err.message);
                updateBackfillState({ status: 'error', finishedAt: new Date().toISOString(), currentProcess: null });
            });

        return response.status(202).json({ status: 'started' });
    };

    status = (request: Request, response: Response): Response => {
        return response.json(getBackfillState());
    };
}

export { BackfillInvestorsController };
