// src/modules/users/useCases/createUser/CreateUserController.ts

import { Request, Response } from 'express';
import { CreateUserUseCase } from './CreateUserUseCase';
import * as yup from 'yup'; // Importa o Yup para validação

/**
 * @class CreateUserController
 * @description Lida com a requisição HTTP para criar um novo utilizador.
 */
class CreateUserController {
    /**
     * Recebe a requisição, valida os dados com Yup, e chama o UseCase.
     * @param {Request} request - O objeto de requisição do Express.
     * @param {Response} response - O objeto de resposta do Express.
     */
    async handle(request: Request, response: Response): Promise<Response> {
        // 1. Define o schema de validação para os dados do formulário.
        const validationSchema = yup.object().shape({
            email: yup.string().email("Formato de e-mail inválido.").required("O e-mail é obrigatório."),
            name: yup.string().required("O nome é obrigatório."),
            // Adicione aqui outras validações para os campos opcionais, se necessário
            phone: yup.string().optional(),
            cellPhone: yup.string().optional(),
            cpfOrCnpj: yup.string().optional(),
        });

        try {
            // 2. Valida o corpo da requisição contra o schema.
            await validationSchema.validate(request.body, { abortEarly: false });
        } catch (err: any) {
            console.error("❌ Erro de validação ao criar utilizador:", err.errors);
            return response.status(400).json({ error: 'Erro de validação.', details: err.errors });
        }

        // 3. Se a validação passou, extrai os dados.
        const {
            email,
            name,
            phone,
            cellPhone,
            cpfOrCnpj
        } = request.body;

        // 4. Instancia e executa o UseCase
        const createUserUseCase = new CreateUserUseCase();

        try {
            // A Action do Auth0 já cria o utilizador no nosso DB, aqui estamos a criar um manualmente
            // A lógica pode ser adaptada para apenas atribuir roles ou dados adicionais no futuro.
            const newUser = await createUserUseCase.execute({
                email,
                name,
                phone,
                cellPhone,
                cpfOrCnpj,
            });
            
            // 5. Retorna o utilizador recém-criado com o status 201 (Created).
            return response.status(201).json(newUser);

        } catch (err: any) {
            // 6. Lida com erros da lógica de negócio (ex: e-mail duplicado).
            console.error("❌ Erro no UseCase ao criar utilizador:", err.message);
            return response.status(400).json({ error: err.message });
        }
    }
}

export { CreateUserController };
