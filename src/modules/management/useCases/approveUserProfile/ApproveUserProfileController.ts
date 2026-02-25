// /src/modules/management/useCases/approveUserProfile/ApproveUserProfileController.ts
import { Request, Response } from 'express';
import { ApproveUserProfileUseCase } from './ApproveUserProfileUseCase';

class ApproveUserProfileController {
    async handle(request: Request, response: Response): Promise<Response> {
        const id = request.params.id as string;
        const useCase = new ApproveUserProfileUseCase();

        try {
            await useCase.execute(id);
            return response.status(204).send();
        } catch (err: any) {
            console.error(`[APPROVE USER] Erro ao aprovar o utilizador ${id}:`, err.message);
            return response.status(500).json({ error: err.message });
        }
    }
}

export { ApproveUserProfileController };
