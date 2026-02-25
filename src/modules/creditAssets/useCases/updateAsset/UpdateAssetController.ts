import { Request, Response } from 'express';
import { UpdateAssetUseCase } from './UpdateAssetUseCase';
import * as yup from 'yup';

class UpdateAssetController {
    private validationSchema = yup.object().shape({
        originalValue: yup.number().positive().optional(),
        acquisitionValue: yup.number().positive().optional(),
        acquisitionDate: yup.date().optional(),
        
        nickname: yup.string().optional().nullable(),
        otherParty: yup.string().optional().nullable(), // <--- NOVO CAMPO EDITÁVEL

        investors: yup.array().of(
            yup.object().shape({
                userId: yup.string().required(),
                share: yup.number().min(0).max(100).optional()
            })
        ).min(1).optional(),
        
        associateId: yup.string().optional().nullable(),
        updateIndexType: yup.string().optional(),
        contractualIndexRate: yup.number().optional().nullable(),
    }).stripUnknown();

    handle = async (request: Request, response: Response): Promise<Response> => {
        const processNumber = request.params.processNumber as string;
        const bodyData = request.body; 

        try {
            const validatedData = await this.validationSchema.validate(bodyData, { abortEarly: false, stripUnknown: true });
            const useCase = new UpdateAssetUseCase();
            const updatedAsset = await useCase.execute({ processNumber, ...validatedData });
            return response.status(200).json(updatedAsset);
        } catch (err: any) {
            return response.status(400).json({ error: err.message });
        }
    }
}
export { UpdateAssetController };