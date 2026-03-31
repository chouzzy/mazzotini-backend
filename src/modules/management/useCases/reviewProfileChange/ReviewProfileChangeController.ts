import { Request, Response } from 'express';
import { ReviewProfileChangeUseCase } from './ReviewProfileChangeUseCase';

class ReviewProfileChangeController {
    approve = async (request: Request, response: Response): Promise<Response> => {
        const { requestId } = request.params;
        try {
            const useCase = new ReviewProfileChangeUseCase();
            const user = await useCase.approve(requestId);
            return response.status(200).json(user);
        } catch (err: any) {
            console.error("[APPROVE PROFILE CHANGE]", err);
            return response.status(400).json({ error: err.message });
        }
    };

    reject = async (request: Request, response: Response): Promise<Response> => {
        const { requestId } = request.params;
        const { reason } = request.body;
        try {
            const useCase = new ReviewProfileChangeUseCase();
            await useCase.reject(requestId, reason);
            return response.status(204).send();
        } catch (err: any) {
            console.error("[REJECT PROFILE CHANGE]", err);
            return response.status(400).json({ error: err.message });
        }
    };
}

export { ReviewProfileChangeController };
