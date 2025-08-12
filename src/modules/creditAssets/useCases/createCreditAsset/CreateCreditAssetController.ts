// src/modules/creditAssets/useCases/createCreditAsset/CreateCreditAssetController.ts

import { Request, Response } from 'express';
import { CreateCreditAssetUseCase } from './CreateCreditAssetUseCase';
import * as yup from 'yup'; // 1. Importa o Yup

/**
 * @class CreateCreditAssetController
 * @description Lida com a requisição HTTP para criar um novo ativo de crédito.
 */
class CreateCreditAssetController {
    /**
     * Recebe a requisição, valida os dados com Yup, e chama o UseCase para criar o ativo.
     * @param {Request} request - O objeto de requisição do Express.
     * @param {Response} response - O objeto de resposta do Express.
     */
    async handle(request: Request, response: Response): Promise<Response> {
        // 2. Define o schema de validação para os dados de entrada.
        const validationSchema = yup.object().shape({
            processNumber: yup.string().required("O número do processo é obrigatório."),
            origemProcesso: yup.string().required("A origem do processo é obrigatória."),
            devedor: yup.string().required("O nome do devedor é obrigatório."),
            originalValue: yup.number().positive("O valor original deve ser positivo.").required("O valor original é obrigatório."),
            acquisitionValue: yup.number().positive("O valor de aquisição deve ser positivo.").required("O valor de aquisição é obrigatório."),
            initialValue: yup.number().positive("O valor inicial deve ser positivo.").required("O valor inicial é obrigatório."),
            acquisitionDate: yup.date().required("A data de aquisição é obrigatória."),
            status: yup.string().required("O status é obrigatório."),
        });

        try {
            // 3. Valida o corpo da requisição contra o schema.
            // O 'abortEarly: false' garante que ele retorne todos os erros de validação, não apenas o primeiro.
            await validationSchema.validate(request.body, { abortEarly: false });
        } catch (err: any) {
            // Se a validação falhar, o Yup lança um erro. Nós o capturamos aqui.
            console.error("❌ Erro de validação:", err.errors);
            // Retorna um erro 400 (Bad Request) com a lista de problemas.
            return response.status(400).json({ error: 'Erro de validação.', details: err.errors });
        }

        // Se a validação passou, a execução continua como antes.
        const {
            processNumber,
            origemProcesso,
            devedor,
            originalValue,
            acquisitionValue,
            initialValue,
            acquisitionDate,
            status,
        } = request.body;

        const createCreditAssetUseCase = new CreateCreditAssetUseCase();

        try {
            const newAsset = await createCreditAssetUseCase.execute({
                processNumber,
                origemProcesso,
                devedor,
                originalValue,
                acquisitionValue,
                initialValue,
                acquisitionDate: new Date(acquisitionDate),
                status,
            });
            
            return response.status(201).json(newAsset);

        } catch (err: any) {
            console.error("❌ Erro ao criar ativo de crédito:", err.message);
            return response.status(400).json({ error: err.message });
        }
    }
}

export { CreateCreditAssetController };
