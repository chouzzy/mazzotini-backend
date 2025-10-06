// /src/modules/creditAssets/useCases/listAllAssets/ListAllAssetsController.ts
import { Request, Response } from 'express';
import { ListAllAssetsUseCase } from './ListAllAssetsUseCase';

// Interface para garantir a tipagem do payload do token
interface CustomJWTPayload {
  sub: string;
  'https://mazzotini.awer.co/roles'?: string[];
}

class ListAllAssetsController {
    async handle(request: Request, response: Response): Promise<Response> {
        const listAllAssetsUseCase = new ListAllAssetsUseCase();

        try {
            // Extrai as informações do utilizador do token JWT
            const payload = (request as any).auth.payload as CustomJWTPayload;
            const auth0UserId = payload.sub;
            const roles = payload['https://mazzotini.awer.co/roles'] || [];

            if (!auth0UserId || roles.length === 0) {
                return response.status(401).json({ error: 'Informações de autenticação insuficientes no token.' });
            }

            // Passa o ID e as roles para o UseCase, que fará a filtragem
            const assets = await listAllAssetsUseCase.execute(auth0UserId, roles);

            return response.status(200).json(assets);
        } catch (err: any) {
            console.error("[LIST ALL ASSETS] Erro ao listar ativos:", err.message);
            return response.status(500).json({ error: 'Erro interno ao buscar os ativos.' });
        }
    }
}

export { ListAllAssetsController };
