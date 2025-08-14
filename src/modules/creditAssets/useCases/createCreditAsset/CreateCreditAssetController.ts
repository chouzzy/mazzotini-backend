// ============================================================================
//   ARQUIVO 2: src/modules/creditAssets/useCases/createCreditAsset/CreateCreditAssetController.ts (ATUALIZADO)
// ============================================================================

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
        // A MUDANÇA: O schema de validação foi atualizado para remover o 'initialValue'.
        const validationSchema = yup.object().shape({
            processNumber: yup.string().matches(/^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/, "Deve ser um número de processo válido").required("O número do processo é obrigatório."),
            originalCreditor: yup.string().required("O nome do credor original é obrigatório."),
            originalValue: yup.number().positive("O valor original deve ser positivo.").required("O valor original é obrigatório."),
            acquisitionValue: yup.number().positive("O valor de aquisição deve ser positivo.").required("O valor de aquisição é obrigatório."),
            acquisitionDate: yup.date().required("A data de aquisição é obrigatória."),
            investorId: yup.string().required("O ID do investidor é obrigatório."),
            investorShare: yup.number().positive("A participação do investidor deve ser positiva.").required("A participação do investidor é obrigatória."),
        });

        try {
            await validationSchema.validate(request.body, { abortEarly: false });
        } catch (err: any) {
            console.error("❌ Erro de validação:", err.errors);
            return response.status(400).json({ error: 'Erro de validação.', details: err.errors });
        }

        // A MUDANÇA: 'initialValue' foi removido da desestruturação.
        const {
            processNumber,
            originalCreditor,
            originalValue,
            acquisitionValue,
            acquisitionDate,
            investorId,
            investorShare
        } = request.body;

        const createCreditAssetUseCase = new CreateCreditAssetUseCase();

        try {
            // A MUDANÇA: 'initialValue' foi removido da chamada do UseCase.
            const newAsset = await createCreditAssetUseCase.execute({
                processNumber,
                originalCreditor,
                originalValue,
                acquisitionValue,
                acquisitionDate: new Date(acquisitionDate),
                investorId,
                investorShare
            });
            
            return response.status(201).json(newAsset);

        } catch (err: any) {
            console.error("❌ Erro ao criar ativo de crédito:", err.message);
            return response.status(400).json({ error: err.message });
        }
    }
}

export { CreateCreditAssetController };