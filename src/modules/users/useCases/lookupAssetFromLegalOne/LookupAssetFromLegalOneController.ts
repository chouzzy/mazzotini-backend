import { Request, Response } from 'express';
import { LookupAssetFromLegalOneUseCase } from './LookupAssetFromLegalOneUseCase';

class LookupAssetFromLegalOneController {
    async handle(request: Request, response: Response): Promise<Response> {
        const { processNumber } = request.params;
        const useCase = new LookupAssetFromLegalOneUseCase();

        try {
            const result = await useCase.execute(processNumber);
            return response.status(200).json(result);

        } catch (err: any) {
            console.error(`[Lookup Asset] Erro ao buscar dados do processo ${processNumber}:`, err.message);
            
            if (err.message.includes("Nenhum processo encontrado")) {
                 return response.status(404).json({ error: err.message });
            }

            return response.status(500).json({ error: err.message });
        }
    }
}

export { LookupAssetFromLegalOneController };