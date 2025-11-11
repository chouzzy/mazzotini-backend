import { Request, Response } from 'express';
import { CreateCreditAssetUseCase } from './CreateCreditAssetUseCase';
import * as yup from 'yup';

/**
 * @class CreateCreditAssetController
 * @description Lida com a requisição HTTP para criar um novo ativo de crédito.
 */
class CreateCreditAssetController {
    async handle(request: Request, response: Response): Promise<Response> {

        console.log("🔄 Criando novo ativo de crédito...");
        
        // --- VALIDAÇÃO (ATUALIZADA) ---
        // Agora inclui os novos campos que vêm da busca do Legal One
        const validationSchema = yup.object().shape({
            // Dados da Busca (obrigatórios)
            processNumber: yup.string().required("O número do processo é obrigatório."),
            originalCreditor: yup.string().required("O credor original (da busca) é obrigatório."),
            origemProcesso: yup.string().required("A origem do processo (da busca) é obrigatória."),
            legalOneId: yup.number().required("O ID do Legal One (da busca) é obrigatório."),
            legalOneType: yup.string().oneOf(['Lawsuit', 'Appeal', 'ProceduralIssue']).required("O Tipo (Lawsuit, etc.) é obrigatório."),

            // Dados da Negociação (obrigatórios)
            acquisitionValue: yup.number().positive("O valor de aquisição deve ser positivo.").required("O valor de aquisição é obrigatório."),
            originalValue: yup.number().positive("O valor original deve ser positivo.").required("O valor original é obrigatório."),
            acquisitionDate: yup.date().required("A data de aquisição é obrigatória."),
            investorId: yup.string().required("O ID do investidor é obrigatório."),
            investorShare: yup.number().min(0).max(100).required("A participação do investidor é obrigatória."),
            
            // Dados dos Índices (obrigatórios)
            updateIndexType: yup.string().required("O índice de correção é obrigatório."),
            contractualIndexRate: yup.number().min(0).optional().nullable(), // Taxa adicional é opcional
            
            // Dados Opcionais
            associateId: yup.string().optional().nullable(),
        });

        try {
            await validationSchema.validate(request.body, { abortEarly: false });
        } catch (err: any) {
            console.error("❌ Erro de validação:", err.errors);
            return response.status(400).json({ error: 'Erro de validação.', details: err.errors });
        }

        // Desestrutura TODOS os campos validados
        const {
            processNumber,
            originalCreditor,
            origemProcesso,
            legalOneId,
            legalOneType,
            acquisitionValue,
            originalValue,
            acquisitionDate,
            investorId,
            investorShare,
            updateIndexType,
            contractualIndexRate,
            associateId, 
        } = request.body;

        const createCreditAssetUseCase = new CreateCreditAssetUseCase();

        try {
            // Envia todos os dados para o UseCase
            const newAsset = await createCreditAssetUseCase.execute({
                processNumber,
                originalCreditor,
                origemProcesso,
                legalOneId,
                legalOneType,
                originalValue,
                acquisitionValue,
                acquisitionDate: new Date(acquisitionDate),
                investorId,
                investorShare,
                updateIndexType,
                contractualIndexRate: contractualIndexRate || 0, // Garante que é um número
                associateId
            });

            return response.status(201).json(newAsset);

        } catch (err: any) {
            console.error("❌ Erro ao criar ativo de crédito:", err.message);
            // Verifica se é um erro de duplicidade
            if (err.message.includes("Já existe um ativo")) {
                return response.status(409).json({ error: err.message }); // 409 Conflict
            }
            return response.status(400).json({ error: err.message });
        }
    }
}

export { CreateCreditAssetController };