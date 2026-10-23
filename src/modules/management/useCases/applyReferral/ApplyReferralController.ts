import { Request, Response } from 'express';
import * as yup from 'yup';
import { ApplyReferralUseCase } from './ApplyReferralUseCase';

class ApplyReferralController {
    private validationSchema = yup.object().shape({
        investmentIds: yup.array().of(yup.string().matches(/^[a-f0-9]{24}$/i, 'Processo inválido.').required()).optional(),
    });

    handle = async (request: Request, response: Response): Promise<Response> => {
        const id = request.params.id as string;
        try {
            const { investmentIds } = await this.validationSchema.validate(request.body ?? {}, { abortEarly: false, stripUnknown: true });
            const result = await new ApplyReferralUseCase().execute(id, investmentIds);
            return response.status(200).json(result);
        } catch (err: any) {
            if (err instanceof yup.ValidationError) {
                return response.status(400).json({ error: 'Erro de validação.', details: err.errors });
            }
            console.error('[APPLY REFERRAL] Erro:', err.message);
            return response.status(400).json({ error: err.message });
        }
    };
}

export { ApplyReferralController };
