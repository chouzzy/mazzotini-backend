import { Request, Response } from 'express';
import { SyncSingleAssetUseCase } from './SyncSingleAssetUseCase';

class SyncSingleAssetController {
    async handle(request: Request, response: Response): Promise<Response> {
        const legalOneId = Number(request.params.legalOneId);
        const syncUseCase = new SyncSingleAssetUseCase();

        try {
            await syncUseCase.execute(legalOneId);
            return response.status(200).json({ message: 'Sincronização concluída com sucesso.' });
        } catch (err: any) {
            console.error(`[SYNC MANUAL] Erro ao sincronizar o processo ${legalOneId}:`, err.message);
            return response.status(500).json({ error: err.message });
        }
    }
}

export { SyncSingleAssetController };
