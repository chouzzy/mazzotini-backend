import { Request, Response } from 'express';
import { GetCalculationLogUseCase } from './GetCalculationLogUseCase';

class GetCalculationLogController {
    async handle(req: Request, res: Response) {
        try {
            const legalOneId = parseInt(req.params.legalOneId, 10);
            const limit      = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
            const useCase    = new GetCalculationLogUseCase();
            const logs       = await useCase.execute(legalOneId, limit);
            return res.status(200).json(logs);
        } catch (error: any) {
            return res.status(400).json({ error: error.message });
        }
    }
}

export { GetCalculationLogController };
