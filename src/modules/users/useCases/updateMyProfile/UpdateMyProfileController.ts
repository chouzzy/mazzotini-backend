// /src/modules/users/useCases/updateMyProfile/UpdateMyProfileController.ts
import { Request, Response } from 'express';
import { UpdateMyProfileUseCase } from './UpdateMyProfileUseCase';
import * as yup from 'yup';

interface CustomJWTPayload {
    sub: string;
}

class UpdateMyProfileController {
    async handle(request: Request, response: Response): Promise<Response> {
        const validationSchema = yup.object().shape({
            cpfOrCnpj: yup.string().required("O CPF/CNPJ é obrigatório."),
            cellPhone: yup.string().required("O telemóvel é obrigatório."),
        });

        try {
            await validationSchema.validate(request.body);
        } catch (err: any) {
            return response.status(400).json({ error: 'Erro de validação.', details: err.errors });
        }

        const payload = (request as any).auth.payload as CustomJWTPayload;
        const auth0UserId = payload.sub;

        const useCase = new UpdateMyProfileUseCase();
        try {
            await useCase.execute({ auth0UserId, data: request.body });
            return response.status(204).send();
        } catch (err: any) {
            console.error("[PROFILE] Erro ao atualizar perfil:", err.message);
            return response.status(500).json({ error: 'Erro interno ao atualizar o perfil.' });
        }
    }
}

export { UpdateMyProfileController };
