// src/modules/creditAssets/useCases/getAssetEstimation/GetAssetEstimationController.ts
import { Request, Response } from 'express';
import { GetAssetEstimationUseCase } from './GetAssetEstimationUseCase';

class GetAssetEstimationController {
    async handle(request: Request, response: Response): Promise<Response> {
        const { assetId } = request.params;
        const useCase = new GetAssetEstimationUseCase();

        try {
            const result = await useCase.execute(assetId);
            return response.status(200).json(result);

        } catch (err: any) {
            console.error(`[Estimate] Erro ao calcular estimativa para o Ativo ${assetId}:`, err.message);
            return response.status(400).json({ error: err.message });
        }
    }
}

export { GetAssetEstimationController };