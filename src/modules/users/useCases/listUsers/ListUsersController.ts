// /src/modules/users/useCases/listUsers/ListUsersController.ts
import { Request, Response } from 'express';
import { ListUsersUseCase } from './ListUsersUseCase';

class ListUsersController {
    async handle(request: Request, response: Response): Promise<Response> {
        const listUsersUseCase = new ListUsersUseCase();

        try {
            const users = await listUsersUseCase.execute();
            // Retorna a lista completa. O frontend decide como formatar.
            return response.status(200).json(users);
        } catch (err: any) {
            console.error("❌ Erro ao listar usuários:", err.message);
            return response.status(500).json({ error: 'Erro interno ao buscar usuários.' });
        }
    }
}

export { ListUsersController };
