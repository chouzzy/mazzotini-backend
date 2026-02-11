import { Request, Response } from 'express';
import { ImportNewAssetsUseCase } from './ImportNewAssetsUseCase';

class ImportNewAssetsController {
    async handle(request: Request, response: Response): Promise<Response> {
        
        // Permite passar uma data opcional via query string ?since=2024-01-01
        // Se não passar, importa tudo (cuidado!)
        const { since } = request.query;
        let sinceDate: Date | undefined;

        if (since) {
            sinceDate = new Date(String(since));
            if (isNaN(sinceDate.getTime())) {
                return response.status(400).json({ error: "Data inválida." });
            }
        }

        const useCase = new ImportNewAssetsUseCase();

        // Executa em background para não travar a requisição HTTP (pode demorar muito)
        useCase.execute(sinceDate)
            .then(() => console.log("[CONTROLLER] Importação em background finalizada."))
            .catch(err => console.error("[CONTROLLER] Erro na importação em background:", err));

        return response.status(202).json({ 
            message: "Importação iniciada em segundo plano. Verifique os logs do servidor para acompanhar." 
        });
    }
}

export { ImportNewAssetsController };