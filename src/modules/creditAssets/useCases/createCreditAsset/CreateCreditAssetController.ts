// src/modules/creditAssets/useCases/createCreditAsset/CreateCreditAssetController.ts

import { Request, Response } from 'express';
import { CreateCreditAssetUseCase } from './CreateCreditAssetUseCase';
import * as yup from 'yup'; // Importa o Yup para validação

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

        console.log("🔄 Criando novo ativo de crédito...");
        // 1. Define o schema de validação para os dados de entrada.
        const validationSchema = yup.object().shape({
            processNumber: yup.string().required("O número do processo é obrigatório."),
            originalCreditor: yup.string().required("O nome do credor original é obrigatório."),
            originalValue: yup.number().positive("O valor original deve ser positivo.").required("O valor original é obrigatório."),
            acquisitionValue: yup.number().positive("O valor de aquisição deve ser positivo.").required("O valor de aquisição é obrigatório."),
            initialValue: yup.number().positive("O valor inicial deve ser positivo.").required("O valor inicial é obrigatório."),
            acquisitionDate: yup.date().required("A data de aquisição é obrigatória."),
        });

        try {
            // 2. Valida o corpo da requisição contra o schema.
            // O 'abortEarly: false' garante que ele retorne todos os erros de validação, não apenas o primeiro.
            await validationSchema.validate(request.body, { abortEarly: false });
        } catch (err: any) {
            // Se a validação falhar, o Yup lança um erro. Nós o capturamos aqui.
            console.error("❌ Erro de validação:", err.errors);
            // Retorna um erro 400 (Bad Request) com a lista de problemas.
            return response.status(400).json({ error: 'Erro de validação.', details: err.errors });
        }

        // 3. Se a validação passou, extrai os dados do corpo da requisição.
        const {
            processNumber,
            originalCreditor,
            originalValue,
            acquisitionValue,
            initialValue,
            acquisitionDate,
        } = request.body;

        // 4. Instancia e executa o UseCase
        const createCreditAssetUseCase = new CreateCreditAssetUseCase();

        try {
            const newAsset = await createCreditAssetUseCase.execute({
                processNumber,
                originalCreditor,
                originalValue,
                acquisitionValue,
                initialValue,
                acquisitionDate: new Date(acquisitionDate), // Garante que a data seja um objeto Date
            });
            
            // 5. Retorna o ativo recém-criado com o status 201 (Created).
            return response.status(201).json(newAsset);

        } catch (err: any) {
            // 6. Lida com erros da lógica de negócio (ex: processo duplicado).
            console.error("❌ Erro ao criar ativo de crédito:", err.message);
            return response.status(400).json({ error: err.message });
        }
    }
}

export { CreateCreditAssetController };
