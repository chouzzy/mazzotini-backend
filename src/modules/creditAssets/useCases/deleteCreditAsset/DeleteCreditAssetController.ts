import { Request, Response } from 'express';
import { DeleteCreditAssetUseCase } from './DeleteCreditAssetUseCase';

class DeleteCreditAssetController {
    async handle(request: Request, response: Response): Promise<Response> {
        const id = request.params.id as string;
        const useCase = new DeleteCreditAssetUseCase();

        try {
            await useCase.execute(id);
            return response.status(204).send(); // 204 No Content (Sucesso sem corpo)
        } catch (err: any) {
            console.error(`[DELETE ASSET ERROR]`, err.message);
            return response.status(400).json({ error: err.message });
        }
    }
}

export { DeleteCreditAssetController };