import { Request, Response } from 'express';
import { AdminUpdateUserUseCase } from './AdminUpdateUserUseCase';
import * as yup from 'yup';

class AdminUpdateUserController {
    // Reutilizamos o mesmo schema de validação do perfil do usuário para garantir consistência
    private validationSchema = yup.object().shape({
        name: yup.string().required(),
        cpfOrCnpj: yup.string().required(),
        rg: yup.string().nullable().optional(),
        birthDate: yup.date().nullable().optional(),
        gender: yup.string().nullable().optional(),
        cellPhone: yup.string().required(),
        phone: yup.string().nullable().optional(),
        profession: yup.string().nullable().optional(),
        contactPreference: yup.string().nullable().optional(),
        infoEmail: yup.string().nullable().optional(),
        
        referredById: yup.string().nullable().optional(),
        indication: yup.string().nullable().optional(),
        
        residentialCep: yup.string().required(),
        residentialStreet: yup.string().required(),
        residentialNumber: yup.string().required(),
        residentialComplement: yup.string().nullable().optional(),
        residentialNeighborhood: yup.string().required(),
        residentialCity: yup.string().required(),
        residentialState: yup.string().required(),
        
        useCommercialAddress: yup.boolean().optional(),
        commercialCep: yup.string().nullable().optional(),
        commercialStreet: yup.string().nullable().optional(),
        commercialNumber: yup.string().nullable().optional(),
        commercialComplement: yup.string().nullable().optional(),
        commercialNeighborhood: yup.string().nullable().optional(),
        commercialCity: yup.string().nullable().optional(),
        commercialState: yup.string().nullable().optional(),
        
        correspondenceAddress: yup.string().optional(),
        nationality: yup.string().nullable().optional(),
        maritalStatus: yup.string().nullable().optional(),
        
        // Admin não precisa reenviar fotos se não quiser alterar
        profilePictureUrl: yup.string().optional(),
    }).noUnknown(true);

    handle = async (request: Request, response: Response): Promise<Response> => {
        const id = request.params.id as string;
        const bodyData = request.body;

        try {
            // Limpeza de campos vazios
            const cleanBody = Object.fromEntries(
                Object.entries(bodyData).filter(([_, v]) => v != null && v !== '')
            );

            // Validação
            const validatedData = await this.validationSchema.validate(cleanBody, { 
                abortEarly: false, 
                stripUnknown: true 
            });

            // Tratamento de Data
            const dataToUpdate = {
                ...validatedData,
                birthDate: validatedData.birthDate ? new Date(validatedData.birthDate) : undefined,
            };

            const useCase = new AdminUpdateUserUseCase();
            const updatedUser = await useCase.execute(id, dataToUpdate);

            return response.status(200).json(updatedUser);

        } catch (err: any) {
             if (err instanceof yup.ValidationError) {
                return response.status(400).json({ error: 'Erro de validação.', details: err.errors });
            }
            console.error("[ADMIN UPDATE] Erro:", err);
            return response.status(400).json({ error: err.message });
        }
    }
}

export { AdminUpdateUserController };