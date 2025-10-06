// /src/modules/management/useCases/updateUserRoles/UpdateUserRolesController.ts
import { Request, Response } from 'express';
import { UpdateUserRolesUseCase } from './UpdateUserRolesUseCase';

class UpdateUserRolesController {
    async handle(request: Request, response: Response): Promise<Response> {
        const { auth0UserId } = request.params;
        const { roles } = request.body; // Espera um array de nomes de roles, ex: ["OPERATOR", "INVESTOR"]

        if (!Array.isArray(roles)) {
            return response.status(400).json({ error: 'O corpo da requisição deve conter um array de "roles".' });
        }

        const useCase = new UpdateUserRolesUseCase();
        try {
            await useCase.execute({ auth0UserId, roles });
            return response.status(204).send(); // 204 No Content para sucesso sem corpo de resposta
        } catch (err: any) {
            console.error(`[UPDATE ROLES] Erro ao atualizar roles para o utilizador ${auth0UserId}:`, err.message);
            return response.status(500).json({ error: err.message });
        }
    }
}

export { UpdateUserRolesController };
