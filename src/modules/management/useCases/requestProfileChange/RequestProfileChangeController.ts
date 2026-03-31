import { Request, Response } from 'express';
import { RequestProfileChangeUseCase } from './RequestProfileChangeUseCase';
import * as yup from 'yup';

const validationSchema = yup.object().shape({
    name: yup.string().required(),
    cpfOrCnpj: yup.string().required(),
    rg: yup.string().nullable().optional(),
    birthDate: yup.string().nullable().optional(),
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
}).noUnknown(true);

class RequestProfileChangeController {
    handle = async (request: Request, response: Response): Promise<Response> => {
        const userId = request.params.id;

        try {
            const cleanBody = Object.fromEntries(
                Object.entries(request.body).filter(([_, v]) => v != null && v !== '')
            );

            const validatedData = await validationSchema.validate(cleanBody, {
                abortEarly: false,
                stripUnknown: true,
            });

            const useCase = new RequestProfileChangeUseCase();
            const result = await useCase.execute(userId, validatedData);

            return response.status(201).json(result);
        } catch (err: any) {
            if (err.name === 'ValidationError') {
                return response.status(400).json({ error: 'Erro de validação.', details: err.errors });
            }
            console.error("[REQUEST PROFILE CHANGE]", err);
            return response.status(400).json({ error: err.message });
        }
    };
}

export { RequestProfileChangeController };
