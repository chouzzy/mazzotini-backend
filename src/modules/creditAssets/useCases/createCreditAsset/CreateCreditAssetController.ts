import { Request, Response } from 'express';
import { CreateCreditAssetUseCase } from './CreateCreditAssetUseCase';
import * as yup from 'yup';

class CreateCreditAssetController {
    async handle(request: Request, response: Response): Promise<Response> {
        console.log("🔄 Criando novo ativo de crédito...");
        
        const validationSchema = yup.object().shape({
            processNumber: yup.string().required(),
            nickname: yup.string().optional(),
            otherParty: yup.string().required(),
            
            folderId: yup.string().optional().nullable(),

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
                    share: yup.number().required(),
                    // ==========================================
                    // CORREÇÃO: Campos adicionados ao schema
                    // Garante que o Prisma recebe um objeto 'Date' válido
                    // ==========================================
                    associateId: yup.string().optional().nullable(),
                    acquisitionDate: yup.date().optional().nullable()
                })
            ).min(1).required(),
            
            updateIndexType: yup.string().required(),
            contractualIndexRate: yup.number().nullable(), 
            associateId: yup.string().nullable().optional(),
        });

        try {
            await validationSchema.validate(request.body, { abortEarly: false });
            const createUseCase = new CreateCreditAssetUseCase();
            const newAsset = await createUseCase.execute(request.body);
            return response.status(201).json(newAsset);
        } catch (err: any) {
            return response.status(400).json({ error: err.message, details: err.errors });
        }
    }
}
export { CreateCreditAssetController };