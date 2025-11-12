// src/modules/creditAssets/useCases/updateAsset/UpdateAssetController.ts
import { Request, Response } from 'express';
import { UpdateAssetUseCase } from './UpdateAssetUseCase';
import * as yup from 'yup';

class UpdateAssetController {
    
    // O schema (isto está correto)
    private validationSchema = yup.object().shape({
        originalValue: yup.number().positive("O valor original deve ser positivo.").optional(),
        acquisitionValue: yup.number().positive("O valor de aquisição deve ser positivo.").optional(),
        acquisitionDate: yup.date().optional(),
        investorId: yup.string().optional(), 
        investorShare: yup.number().min(0).max(100).optional(), 
        associateId: yup.string().optional().nullable(),
        updateIndexType: yup.string().optional(),
        contractualIndexRate: yup.number().optional().nullable(),
    });
    // Não precisamos de stripUnknown aqui se o fizermos na validação

    // =================================================================
    // A CORREÇÃO (O Erro do 'this')
    // Trocamos 'async handle(...)' por 'handle = async (...)'
    // A "arrow function" garante que o 'this' da classe seja mantido
    // quando o Express chamar esta função.
    // =================================================================
    handle = async (request: Request, response: Response): Promise<Response> => {
        const { processNumber } = request.params;
        const bodyData = request.body; 
        let validatedData; 

        console.log("[UpdateAsset] Dados recebidos para atualização:", bodyData);

        try {
            // 'this.validationSchema' agora vai funcionar
            validatedData = await this.validationSchema.validate(bodyData, { 
                abortEarly: false, 
                stripUnknown: true // Remove campos extras (como 'originalCreditor')
            });

        } catch (err: any) {
            // Log de erro melhorado
            console.error("[UpdateAsset] Erro de validação. Mensagem:", err.message);
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