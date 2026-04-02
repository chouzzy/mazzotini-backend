import { Request, Response } from 'express';
import { GetAssetByProcessNumberUseCase } from './GetAssetByProcessNumberUseCase';

interface CustomJWTPayload {
    sub: string;
    'https://mazzotini.awer.co/roles'?: string[];
}

class GetAssetByProcessNumberController {
    async handle(request: Request, response: Response): Promise<Response> {
        const legalOneId = Number(request.params.legalOneId);
        
        // Pega os dados do usuário que fez a requisição
        const payload = (request as any).auth.payload as CustomJWTPayload;
        const auth0UserId = payload.sub;
        const roles = payload['https://mazzotini.awer.co/roles'] || [];

        const getUseCase = new GetAssetByProcessNumberUseCase();
        
        try {
            // Passa o usuário e a role para o UseCase auditar
            const asset = await getUseCase.execute(legalOneId, auth0UserId, roles);
            return response.json(asset);
        } catch (err: any) {
            if (err.message === "Acesso negado.") {
                return response.status(403).json({ error: "Você não tem permissão para visualizar este processo." });
            }
            return response.status(404).json({ error: err.message });
        }
    }
}
export { GetAssetByProcessNumberController };