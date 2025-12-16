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
            gender: yup.string().optional(),
            // CORREÇÃO: Aceita o ID ou a Indicação Manual
            indication: yup.string().nullable().optional(),

            // CORREÇÃO: Adicionado .nullable() a todos os campos opcionais
            rg: yup.string().optional().nullable(),
            birthDate: yup.date().optional().nullable(),
            profession: yup.string().optional().nullable(),
            contactPreference: yup.string().optional().nullable(),
            infoEmail: yup.string().email("Formato de e-mail inválido.").optional().nullable(),

            residentialCep: yup.string().required("O CEP Residencial é obrigatório."),
            residentialStreet: yup.string().required("A Rua Residencial é obrigatória."),
            residentialNumber: yup.string().required("O Número Residencial é obrigatório."),
            residentialComplement: yup.string().optional().nullable(),
            residentialNeighborhood: yup.string().required("O Bairro Residencial é obrigatório."),
            residentialCity: yup.string().required("A Cidade Residencial é obrigatória."),
            residentialState: yup.string().required("O Estado Residencial é obrigatório."),

            useCommercialAddress: yup.boolean().optional(),
            commercialCep: yup.string().optional().nullable(),
            commercialStreet: yup.string().optional().nullable(),
            commercialNumber: yup.string().optional().nullable(),
            commercialComplement: yup.string().optional().nullable(),
            commercialNeighborhood: yup.string().optional().nullable(),
            commercialCity: yup.string().optional().nullable(),
            commercialState: yup.string().optional().nullable(),

            correspondenceAddress: yup.string().optional().default("residential"),

            nationality: yup.string().optional().nullable(),
            maritalStatus: yup.string().optional().nullable(),
            referredById: yup.string().optional().nullable(), // ID do Associado
        });

        const payload = (request as any).auth.payload as CustomJWTPayload;
        const auth0UserId = payload.sub;
        const useCase = new UpdateMyProfileUseCase();

        try {
            // Valida os dados ANTES de qualquer outra lógica
            // stripUnknown: true é uma prática sénior que remove quaisquer campos extras que o frontend envie
            const validatedData = await validationSchema.validate(request.body, { abortEarly: false, stripUnknown: true });

            // A data do 'birthDate' vem como string do formulário, precisamos de a converter.
            const dataToUpdate = {
                ...validatedData,
                birthDate: validatedData.birthDate ? new Date(validatedData.birthDate) : undefined,
            };

            await useCase.execute({ auth0UserId, data: dataToUpdate });
            return response.status(204).send(); // 204 No Content (sucesso sem corpo de resposta)
        } catch (err: any) {
            // Trata erros de validação do Yup
            if (err instanceof yup.ValidationError) {
                console.error("[PROFILE VALIDATION ERROR]", err.errors);
                return response.status(400).json({ error: 'Erro de validação.', details: err.errors });
            }
            // Trata outros erros
            console.error("[PROFILE] Erro ao atualizar perfil:", err.message);
            return response.status(500).json({ error: 'Erro interno ao atualizar o perfil.' });
        }
    }
}

export { UpdateMyProfileController };

