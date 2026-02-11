import { Request, Response } from 'express';
import { ListAllFoldersUseCase } from './ListAllFoldersUseCase';

// Interface para o payload do token (Auth0)
interface CustomJWTPayload {
    sub: string;
    'https://mazzotini.awer.co/roles'?: string[];
}

class ListAllFoldersController {
    async handle(request: Request, response: Response): Promise<Response> {
        const payload = (request as any).auth.payload as CustomJWTPayload;
        const auth0UserId = payload.sub;
        const roles = payload['https://mazzotini.awer.co/roles'] || [];

        const useCase = new ListAllFoldersUseCase();
        
        try {
            const folders = await useCase.execute(auth0UserId, roles);
            return response.json(folders);
        } catch (err: any) {
            console.error("[FOLDERS] Erro:", err);
            return response.status(500).json({ error: err.message });
        }
    }
}
export { ListAllFoldersController };