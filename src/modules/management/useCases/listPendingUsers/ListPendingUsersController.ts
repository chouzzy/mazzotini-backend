// /src/modules/management/useCases/listPendingUsers/ListPendingUsersController.ts
import { Request, Response } from 'express';
import { ListPendingUsersUseCase } from './ListPendingUsersUseCase';

class ListPendingUsersController {
    async handle(request: Request, response: Response): Promise<Response> {
        const useCase = new ListPendingUsersUseCase();
        try {
            const users = await useCase.execute();
            return response.status(200).json(users);
        } catch (err: any) {
            console.error("[LIST PENDING] Erro ao buscar perfis pendentes:", err.message);
            return response.status(500).json({ error: 'Erro interno ao buscar perfis.' });
        }
    }
}

export { ListPendingUsersController };
