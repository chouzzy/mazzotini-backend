// src/modules/creditAssets/useCases/getAssetEstimation/GetAssetEstimationController.ts
import { Request, Response } from 'express';
import { GetAssetEstimationUseCase } from './GetAssetEstimationUseCase';
import { AppError } from '../../../../errors/AppError';

class GetAssetEstimationController {
    async handle(request: Request, response: Response): Promise<Response> {
        const assetId = request.params.assetId as string;
        const payload = (request as any).auth?.payload ?? {};
        const viewer = { auth0UserId: payload.sub as string, roles: (payload['https://mazzotini.awer.co/roles'] as string[]) || [] };
        const useCase = new GetAssetEstimationUseCase();

        try {
            const result = await useCase.execute(assetId, viewer);
            return response.status(200).json(result);

        } catch (err: any) {
            console.error(`[Estimate] Erro ao calcular estimativa para o Ativo ${assetId}:`, err.message);
            const status = err instanceof AppError ? err.statusCode : 400;
            return response.status(status).json({ error: err.message });
        }
    }
}

export { GetAssetEstimationController };