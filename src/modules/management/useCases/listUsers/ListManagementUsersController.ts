import { Request, Response } from 'express';
import { ListManagementUsersUseCase } from './ListManagementUsersUseCase';

class ListManagementUsersController {
    async handle(request: Request, response: Response): Promise<Response> {
        const { page, limit, search, role, status, associateSearch } = request.query;

        const useCase = new ListManagementUsersUseCase();

        try {
            const result = await useCase.execute({
                page: page ? Number(page) : 1,
                limit: limit ? Number(limit) : 10,
                search: search ? String(search) : undefined,
                role: role ? String(role) : undefined,
                status: status ? String(status) : undefined,
                associateSearch: associateSearch ? String(associateSearch) : undefined,
            });
            
            return response.status(200).json(result);
        } catch (err: any) {
            console.error("[LIST MGMT USERS] Erro:", err.message);
            return response.status(500).json({ error: 'Erro ao buscar lista de usuários.' });
        }
    }
}

export { ListManagementUsersController };