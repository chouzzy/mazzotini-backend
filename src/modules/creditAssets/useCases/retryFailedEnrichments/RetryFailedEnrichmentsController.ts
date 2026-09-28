import { Request, Response } from 'express';
import { RetryFailedEnrichmentsUseCase } from './RetryFailedEnrichmentsUseCase';

class RetryFailedEnrichmentsController {
    async handle(request: Request, response: Response): Promise<Response> {
        const useCase = new RetryFailedEnrichmentsUseCase();

        // Dispara em background: a varredura respeita throttle do Legal One e pode
        // levar minutos, tempo demais para segurar a requisição HTTP aberta.
        useCase.execute().catch(err =>
            console.error('[RetryEnrich] Falha na varredura manual:', err.message)
        );

        return response.status(202).json({
            status: 'started',
            message: 'Reprocessamento de ativos travados iniciado. Acompanhe os logs do servidor.',
        });
    }
}

export { RetryFailedEnrichmentsController };
