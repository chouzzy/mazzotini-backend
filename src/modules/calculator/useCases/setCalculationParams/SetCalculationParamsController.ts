import { Request, Response } from 'express';
import { SetCalculationParamsUseCase } from './SetCalculationParamsUseCase';

class SetCalculationParamsController {
    async handle(req: Request, res: Response) {
        try {
            const legalOneId = parseInt(req.params.legalOneId, 10);
            const useCase = new SetCalculationParamsUseCase();
            const result = await useCase.execute({ legalOneId, ...req.body });
            return res.status(200).json(result);
        } catch (error: any) {
            return res.status(400).json({ error: error.message });
        }
    }
}

export { SetCalculationParamsController };
