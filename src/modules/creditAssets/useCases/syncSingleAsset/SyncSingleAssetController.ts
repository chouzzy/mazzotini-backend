import { Request, Response } from 'express';
import { SyncSingleAssetUseCase } from './SyncSingleAssetUseCase';

class SyncSingleAssetController {
    async handle(request: Request, response: Response): Promise<Response> {
        const processNumber = request.params.processNumber as string;
        const syncUseCase = new SyncSingleAssetUseCase();

        try {
            await syncUseCase.execute(processNumber);
            return response.status(200).json({ message: 'Sincronização concluída com sucesso.' });
        } catch (err: any) {
            console.error(`[SYNC MANUAL] Erro ao sincronizar o processo ${processNumber}:`, err.message);
            return response.status(500).json({ error: err.message });
        }
    }
}

export { SyncSingleAssetController };
