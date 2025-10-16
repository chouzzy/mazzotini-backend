// /src/modules/users/useCases/updateMyProfile/UpdateMyProfileController.ts
import { Request, Response } from 'express';
import { UpdateMyProfileUseCase } from './UpdateMyProfileUseCase';
import * as yup from 'yup';

interface CustomJWTPayload {
    sub: string;
}

class UpdateMyProfileController {
    async handle(request: Request, response: Response): Promise<Response> {
        // O schema de validação foi expandido para incluir os novos campos,
        // mantendo apenas os essenciais como obrigatórios.
        const validationSchema = yup.object().shape({
            name: yup.string().required("O nome é obrigatório."),
            cpfOrCnpj: yup.string().required("O CPF/CNPJ é obrigatório."),
            cellPhone: yup.string().required("O telemóvel é obrigatório."),
            birthDate: yup.date().optional().nullable(),
            rg: yup.string().optional(),
            profession: yup.string().optional(),
            contactPreference: yup.string().optional(),
            infoEmail: yup.string().email("Formato de e-mail inválido.").optional(),
            residentialCep: yup.string().optional(),
            // ... outras validações opcionais para os campos de endereço podem ser adicionadas aqui
        });

        try {
            await validationSchema.validate(request.body, { abortEarly: false });
        } catch (err: any) {
            return response.status(400).json({ error: 'Erro de validação.', details: err.errors });
        }

        const payload = (request as any).auth.payload as CustomJWTPayload;
        const auth0UserId = payload.sub;
        const useCase = new UpdateMyProfileUseCase();

        try {
            // A data do 'birthDate' vem como string do formulário, precisamos de a converter.
            const dataToUpdate = {
                ...request.body,
                birthDate: request.body.birthDate ? new Date(request.body.birthDate) : undefined,
            };

            await useCase.execute({ auth0UserId, data: dataToUpdate });
            return response.status(204).send();
        } catch (err: any) {
            console.error("[PROFILE] Erro ao atualizar perfil:", err.message);
            return response.status(500).json({ error: 'Erro interno ao atualizar o perfil.' });
        }
    }
}

export { UpdateMyProfileController };
