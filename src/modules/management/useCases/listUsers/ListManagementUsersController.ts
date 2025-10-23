// /src/modules/management/useCases/listUsers/ListManagementUsersController.ts
import { Request, Response } from 'express';
import { ListManagementUsersUseCase } from './ListManagementUsersUseCase';

class ListManagementUsersController {
    async handle(request: Request, response: Response): Promise<Response> {
        const useCase = new ListManagementUsersUseCase();
        try {
            // Executa o UseCase que já construímos
            const users = await useCase.execute();
            
            // Retorna os dados formatados para o frontend
            return response.status(200).json(users);
        } catch (err: any) {
            console.error("[LIST MGMT USERS] Erro ao buscar utilizadores:", err.message);
            return response.status(500).json({ error: 'Erro interno ao comunicar com a API de gestão.' });
        }
    }
}

export { ListManagementUsersController };
