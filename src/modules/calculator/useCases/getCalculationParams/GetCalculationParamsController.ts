import { Request, Response } from 'express';
import { GetCalculationParamsUseCase } from './GetCalculationParamsUseCase';

class GetCalculationParamsController {
    async handle(req: Request, res: Response) {
        try {
            const legalOneId = parseInt(req.params.legalOneId, 10);
            const useCase = new GetCalculationParamsUseCase();
            const result = await useCase.execute(legalOneId);
            return res.status(200).json(result);
        } catch (error: any) {
            return res.status(400).json({ error: error.message });
        }
    }
}

export { GetCalculationParamsController };
