import { Request, Response } from 'express';
import { HealthCheckUseCase } from './HealthCheckUseCase';
import { prisma } from '../../../../prisma';

class RunHealthCheckController {
    async handle(request: Request, response: Response): Promise<Response> {
        try {
            const useCase = new HealthCheckUseCase();
            const log = await useCase.execute('manual');
            return response.status(200).json(log);
        } catch (err: any) {
            console.error('[HEALTH CHECK] Erro:', err.message);
            return response.status(500).json({ error: err.message });
        }
    }
}

class GetHealthLogsController {
    async handle(request: Request, response: Response): Promise<Response> {
        try {
            const limit = Number(request.query.limit) || 30;
            const logs = await prisma.systemHealthLog.findMany({
                orderBy: { runAt: 'desc' },
                take: limit,
            });
            return response.status(200).json(logs);
        } catch (err: any) {
            return response.status(500).json({ error: err.message });
        }
    }
}

export { RunHealthCheckController, GetHealthLogsController };
