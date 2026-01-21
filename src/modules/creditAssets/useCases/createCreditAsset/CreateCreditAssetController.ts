import { Request, Response } from 'express';
import { CreateCreditAssetUseCase } from './CreateCreditAssetUseCase';
import * as yup from 'yup';

class CreateCreditAssetController {
    async handle(request: Request, response: Response): Promise<Response> {
        console.log("🔄 Criando novo ativo de crédito...");
        
        const validationSchema = yup.object().shape({
            processNumber: yup.string().required(),
            
            nickname: yup.string().optional(), // Apelido (Opcional)
            otherParty: yup.string().required("A Parte Contrária é obrigatória."), // <--- NOVO (Obrigatório pois vem do Legal One)

            originalCreditor: yup.string().required(),
            origemProcesso: yup.string().required(),
            legalOneId: yup.number().required(),
            legalOneType: yup.string().required(),
            acquisitionValue: yup.number().positive().required(),
            originalValue: yup.number().positive().required(),
            acquisitionDate: yup.date().required(),
            
            investors: yup.array().of(
                yup.object().shape({
                    userId: yup.string().required(),
                    share: yup.number().required()
                })
            ).min(1).required(),
            
            updateIndexType: yup.string().required(),
            contractualIndexRate: yup.number().nullable().optional(), 
            associateId: yup.string().nullable().optional(),
        });

        try {
            await validationSchema.validate(request.body, { abortEarly: false });
            const createCreditAssetUseCase = new CreateCreditAssetUseCase();
            const newAsset = await createCreditAssetUseCase.execute(request.body);
            return response.status(201).json(newAsset);
        } catch (err: any) {
            return response.status(400).json({ error: err.message });
        }
    }
}
export { CreateCreditAssetController };