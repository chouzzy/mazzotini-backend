// Caminho: src/modules/creditAssets/useCases/listAllAssets/ListAllAssetsController.ts

import { Request, Response } from 'express';
import { ListAllAssetsUseCase } from './ListAllAssetsUseCase';

interface CustomJWTPayload {
    sub: string;
    'https://mazzotini.awer.co/roles'?: string[];
}

class ListAllAssetsController {
    async handle(request: Request, response: Response): Promise<Response> {
        const payload = (request as any).auth.payload as CustomJWTPayload;
        const auth0UserId = payload.sub;
        const roles = payload['https://mazzotini.awer.co/roles'] || [];

        // Extrai o novo parâmetro "type"
        const { page, limit, search, status, type } = request.query;

        const useCase = new ListAllAssetsUseCase();

        try {
            const result = await useCase.execute({
                auth0UserId,
                roles,
                page: page ? Number(page) : 1,
                limit: limit ? Number(limit) : 10,
                search: search ? String(search) : undefined,
                status: status ? String(status) : undefined,
                type: type ? String(type) : undefined, // <-- NOVO FILTRO
            });

            return response.json(result);
        } catch (err: any) {
            console.error("[LIST ASSETS] Erro:", err.message);
            return response.status(500).json({ error: err.message });
        }
    }
}

export { ListAllAssetsController };