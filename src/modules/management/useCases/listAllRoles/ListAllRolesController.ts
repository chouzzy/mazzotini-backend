// /src/modules/management/useCases/listAllRoles/ListAllRolesController.ts
import { Request, Response } from 'express';
import { ListAllRolesUseCase } from './ListAllRolesUseCase';

class ListAllRolesController {
    async handle(request: Request, response: Response): Promise<Response> {
        const useCase = new ListAllRolesUseCase();
        try {
            const roles = await useCase.execute();
            // Retorna apenas os campos que o frontend precisa
            const formattedRoles = roles.map(r => ({ id: r.id, name: r.name, description: r.description }));
            return response.status(200).json(formattedRoles);
        } catch (err: any) {
            console.error("[LIST ROLES] Erro ao buscar roles:", err.message);
            return response.status(500).json({ error: 'Erro interno ao buscar as roles.' });
        }
    }
}

export { ListAllRolesController };
