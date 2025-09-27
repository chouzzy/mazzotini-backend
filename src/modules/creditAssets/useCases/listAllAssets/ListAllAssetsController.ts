// /src/modules/creditAssets/useCases/listAllAssets/ListAllAssetsController.ts
import { Request, Response } from 'express';
import { ListAllAssetsUseCase } from './ListAllAssetsUseCase';

/**
 * @class ListAllAssetsController
 * @description Lida com a requisição HTTP para listar todos os ativos de crédito.
 */
class ListAllAssetsController {
    async handle(request: Request, response: Response): Promise<Response> {
        const listAllAssetsUseCase = new ListAllAssetsUseCase();

        try {
            const assets = await listAllAssetsUseCase.execute();
            return response.status(200).json(assets);
        } catch (err: any) {
            console.error("[ADMIN] Erro ao listar todos os ativos:", err.message);
            return response.status(500).json({ error: 'Erro interno ao buscar ativos.' });
        }
    }
}

export { ListAllAssetsController };

