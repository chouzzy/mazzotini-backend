import { Request, Response } from 'express';
import { UpdateUserInvestmentsUseCase } from './UpdateUserInvestmentsUseCase';
import * as yup from 'yup';

class UpdateUserInvestmentsController {
    async handle(request: Request, response: Response): Promise<Response> {
        const { id } = request.params;
        const { investments } = request.body;

        const schema = yup.object().shape({
            investments: yup.array().of(
                yup.object().shape({
                    assetId: yup.string().required(),
                    share: yup.number().min(0).max(100).required(),
                    documents: yup.array().of(yup.string()).optional() // <-- NOVO
                })
            ).required()
        });

        try {
            await schema.validate({ investments });
            const useCase = new UpdateUserInvestmentsUseCase();
            await useCase.execute({ userId: id, investments });
            return response.status(204).send();
        } catch (err: any) {
            return response.status(400).json({ error: err.message });
        }
    }
}

export { UpdateUserInvestmentsController };