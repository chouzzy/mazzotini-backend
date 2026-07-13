import { Request, Response } from 'express';
import { SyncFeeContractsUseCase } from './SyncFeeContractsUseCase';

export class SyncFeeContractsController {
    async handle(req: Request, res: Response) {
        try {
            const useCase = new SyncFeeContractsUseCase();
            const result = await useCase.execute();
            return res.json({ success: true, ...result });
        } catch (err: any) {
            console.error('[SyncFeeContracts] Erro crítico:', err.message);
            return res.status(500).json({ error: 'Erro ao sincronizar contratos de honorários' });
        }
    }
}
