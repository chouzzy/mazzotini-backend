import { Request, Response } from 'express';
import { RunCalculationUseCase } from './RunCalculationUseCase';

class RunCalculationController {
    async handle(req: Request, res: Response) {
        try {
            const legalOneId  = parseInt(req.params.legalOneId, 10);
            const auth0UserId = (req as any).auth?.payload?.sub ?? 'manual';
            const { referenceYear, referenceMonth } = req.body;

            const useCase = new RunCalculationUseCase();
            const result  = await useCase.execute({ legalOneId, auth0UserId, referenceYear, referenceMonth });
            return res.status(200).json(result);
        } catch (error: any) {
            return res.status(400).json({ error: error.message });
        }
    }
}

export { RunCalculationController };
