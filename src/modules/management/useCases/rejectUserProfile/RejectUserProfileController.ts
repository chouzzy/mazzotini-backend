// /src/modules/management/useCases/rejectUserProfile/RejectUserProfileController.ts
import { Request, Response } from 'express';
import { RejectUserProfileUseCase } from './RejectUserProfileUseCase';

class RejectUserProfileController {
    async handle(request: Request, response: Response): Promise<Response> {
        const id = request.params.id as string;
        const useCase = new RejectUserProfileUseCase();

        try {
            await useCase.execute(id);
            return response.status(204).send();
        } catch (err: any) {
            console.error(`[REJECT USER] Erro ao rejeitar o utilizador ${id}:`, err.message);
            return response.status(500).json({ error: err.message });
        }
    }
}

export { RejectUserProfileController };
