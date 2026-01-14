import { Request, Response } from 'express';
import { CreateCreditAssetUseCase } from './CreateCreditAssetUseCase';
import * as yup from 'yup';

class CreateCreditAssetController {
    async handle(request: Request, response: Response): Promise<Response> {

        console.log("🔄 Criando novo ativo de crédito...");
        
        const validationSchema = yup.object().shape({
            processNumber: yup.string().required("O número do processo é obrigatório."),
            
            // NOVO CAMPO (Opcional)
            nickname: yup.string().optional(),

            originalCreditor: yup.string().required("O credor original (da busca) é obrigatório."),
            origemProcesso: yup.string().required("A origem do processo (da busca) é obrigatória."),
            legalOneId: yup.number().required("O ID do Legal One (da busca) é obrigatório."),
            legalOneType: yup.string().oneOf(['Lawsuit', 'Appeal', 'ProceduralIssue']).required("O Tipo é obrigatório."),

            acquisitionValue: yup.number().positive("O valor de aquisição deve ser positivo.").required(),
            originalValue: yup.number().positive("O valor original deve ser positivo.").required(),
            acquisitionDate: yup.date().required("A data de aquisição é obrigatória."),
            
            investors: yup.array().of(
                yup.object().shape({
                    userId: yup.string().required("O ID do investidor é obrigatório."),
                    share: yup.number().min(0).max(100).required("A participação é obrigatória.")
                })
            ).min(1, "É preciso associar pelo menos um investidor.").required(),
            
            updateIndexType: yup.string().required("O índice de correção é obrigatório."),
            contractualIndexRate: yup.number().min(0).optional().nullable(), 
            associateId: yup.string().optional().nullable(),
        });

        try {
            await validationSchema.validate(request.body, { abortEarly: false });
        } catch (err: any) {
            console.error("❌ Erro de validação:", err.errors);
            return response.status(400).json({ error: 'Erro de validação.', details: err.errors });
        }

        const createCreditAssetUseCase = new CreateCreditAssetUseCase();

        try {
            const newAsset = await createCreditAssetUseCase.execute(request.body);
            return response.status(201).json(newAsset);

        } catch (err: any) {
            console.error("❌ Erro ao criar ativo de crédito:", err.message);
            if (err.message.includes("Já existe um ativo")) {
                return response.status(409).json({ error: err.message });
            }
            return response.status(400).json({ error: err.message });
        }
    }
}

export { CreateCreditAssetController };