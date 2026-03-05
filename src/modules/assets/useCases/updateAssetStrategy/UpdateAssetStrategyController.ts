import { Request, Response } from 'express';
import { UpdateAssetStrategyUseCase } from './UpdateAssetStrategyUseCase';
// import { UpdateAssetStrategyUseCase } from './UpdateAssetStrategyUseCase';

export class UpdateAssetStrategyController {
    async handle(request: Request, response: Response) {
        const { id } = request.params;
        const { strategyText } = request.body;

        const updateAssetStrategyUseCase = new UpdateAssetStrategyUseCase();

        const asset = await updateAssetStrategyUseCase.execute({
            assetId: id as string, // O nosso famoso casting de segurança!
            strategyText
        });

        return response.json(asset);
    }
}