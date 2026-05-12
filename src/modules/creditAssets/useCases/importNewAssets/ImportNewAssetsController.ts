import { Request, Response } from 'express';
import { ImportNewAssetsUseCase } from './ImportNewAssetsUseCase';
import { prisma } from '../../../../prisma';

class ImportNewAssetsController {
    async handle(request: Request, response: Response): Promise<Response> {
        const { since } = request.query;
        const auth0UserId = (request as any).auth?.payload?.sub as string | undefined;

        let sinceDate: Date | undefined;
        if (since) {
            sinceDate = new Date(String(since));
            if (isNaN(sinceDate.getTime())) {
                return response.status(400).json({ error: "Data inválida." });
            }
        }

        // Cria registro de log antes de iniciar
        const log = await prisma.importLog.create({
            data: {
                triggeredBy: auth0UserId || 'cron',
                since: sinceDate || null,
                status: 'running',
            },
        });

        const useCase = new ImportNewAssetsUseCase();

        // Executa em background passando o logId para atualização posterior
        useCase.execute(sinceDate, log.id)
            .then(() => console.log("[CONTROLLER] Importação em background finalizada."))
            .catch(async (err) => {
                console.error("[CONTROLLER] Erro na importação em background:", err);
                await prisma.importLog.update({
                    where: { id: log.id },
                    data: { status: 'failed', finishedAt: new Date() },
                }).catch(() => {});
            });

        return response.status(202).json({
            message: "Importação iniciada em segundo plano.",
            logId: log.id,
        });
    }
}

// Controller separado para listar histórico
class GetImportLogsController {
    async handle(_request: Request, response: Response): Promise<Response> {
        const logs = await prisma.importLog.findMany({
            orderBy: { triggeredAt: 'desc' },
            take: 50,
        });
        return response.status(200).json(logs);
    }
}

export { ImportNewAssetsController, GetImportLogsController };
