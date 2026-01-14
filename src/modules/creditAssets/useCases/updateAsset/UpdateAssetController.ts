import { Request, Response } from 'express';
import { UpdateAssetUseCase } from './UpdateAssetUseCase';
import * as yup from 'yup';

class UpdateAssetController {
    
    private validationSchema = yup.object().shape({
        originalValue: yup.number().positive().optional(),
        acquisitionValue: yup.number().positive().optional(),
        acquisitionDate: yup.date().optional(),
        
        // NOVO CAMPO
        nickname: yup.string().optional().nullable(),

        investors: yup.array().of(
            yup.object().shape({
                userId: yup.string().required(),
                share: yup.number().min(0).max(100).optional()
            })
        ).min(1).optional(),
        
        associateId: yup.string().optional().nullable(),
        updateIndexType: yup.string().optional(),
        contractualIndexRate: yup.number().optional().nullable(),
    })
    .stripUnknown();

    handle = async (request: Request, response: Response): Promise<Response> => {
        const { processNumber } = request.params;
        const bodyData = request.body; 
        let validatedData; 

        try {
            validatedData = await this.validationSchema.validate(bodyData, { 
                abortEarly: false, 
                stripUnknown: true 
            });

        } catch (err: any) {
            const errorDetails = err.inner ? err.inner.map((e: any) => e.message) : [err.message];
            return response.status(400).json({ error: 'Erro de validação.', details: errorDetails });
        }

        const useCase = new UpdateAssetUseCase();

        try {
            const updatedAsset = await useCase.execute({
                processNumber,
                ...validatedData 
            });
            return response.status(200).json(updatedAsset);

        } catch (err: any) {
            if (err.message.includes("não encontrado")) {
                 return response.status(404).json({ error: err.message });
            }
            return response.status(400).json({ error: err.message });
        }
    }
}

export { UpdateAssetController };