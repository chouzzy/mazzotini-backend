// src/modules/creditAssets/useCases/updateAsset/UpdateAssetController.ts
import { Request, Response } from 'express';
import { UpdateAssetUseCase } from './UpdateAssetUseCase';
import * as yup from 'yup';

class UpdateAssetController {
    
    // =================================================================
    //  A MUDANÇA (Funcionalidade 2)
    // =================================================================
    // O schema de validação agora espera um ARRAY 'investors'
    // Todos os campos são 'optional()' porque um PATCH pode atualizar
    // só os investidores, ou só o 'associateId', etc.
    private validationSchema = yup.object().shape({
        originalValue: yup.number().positive("O valor original deve ser positivo.").optional(),
        acquisitionValue: yup.number().positive("O valor de aquisição deve ser positivo.").optional(),
        acquisitionDate: yup.date().optional(),
        
        // --- A MUDANÇA ESTÁ AQUI ---
        investors: yup.array().of(
            yup.object().shape({
                userId: yup.string().required("O ID do investidor é obrigatório."),
                share: yup.number().min(0).max(100).required("A participação é obrigatória.")
            })
        ).min(1, "É preciso associar pelo menos um investidor.").optional(), // É opcional no PATCH
        // --- FIM DA MUDANÇA ---
        
        associateId: yup.string().optional().nullable(),
        updateIndexType: yup.string().optional(),
        contractualIndexRate: yup.number().optional().nullable(),
    })
    .stripUnknown(); // Ignora campos imutáveis (processNumber, etc.)

    // "Arrow function" para garantir o 'this'
    handle = async (request: Request, response: Response): Promise<Response> => {
        const { processNumber } = request.params;
        const bodyData = request.body; 
        let validatedData; 

        console.log("[UpdateAsset] Dados recebidos para atualização:", bodyData);

        try {
            validatedData = await this.validationSchema.validate(bodyData, { 
                abortEarly: false, 
                stripUnknown: true 
            });

        } catch (err: any) {
            console.error("[UpdateAsset] Erro de validação:", err.message);
            console.error("[UpdateAsset] Detalhes do Erro (Inner):", err.inner); 
            
            const errorDetails = err.inner ? err.inner.map((e: any) => e.message) : [err.message];
            return response.status(400).json({ error: 'Erro de validação.', details: errorDetails });
        }

        console.log("[UpdateAsset] Dados validados e limpos:", validatedData);

        const useCase = new UpdateAssetUseCase();

        try {
            const updatedAsset = await useCase.execute({
                processNumber,
                ...validatedData 
            });
            return response.status(200).json(updatedAsset);

        } catch (err: any) {
            console.error(`[UpdateAsset] Erro ao atualizar ativo ${processNumber}:`, err.message);
            if (err.message.includes("não encontrado")) {
                 return response.status(404).json({ error: err.message });
            }
            return response.status(400).json({ error: err.message });
        }
    }
}

export { UpdateAssetController };