import { Request, Response } from 'express';
import { EnrichAssetFromLegalOneUseCase } from './EnrichAssetFromLegalOneUseCase';

/**
 * @class EnrichAssetFromLegalOneController
 * @description Lida com a requisição HTTP para iniciar o processo de enriquecimento de um ativo.
 */
class EnrichAssetFromLegalOneController {
    /**
     * Recebe a requisição, extrai o ID do ativo e aciona o UseCase para rodar em segundo plano.
     * @param {Request} request - O objeto de requisição do Express.
     * @param {Response} response - O objeto de resposta do Express.
     */
    async handle(request: Request, response: Response): Promise<Response> {
        // 1. Extrai o ID do ativo dos parâmetros da rota (ex: /api/assets/:id/enrich)
        const id = request.params.id as string;

        if (!id) {
            return response.status(400).json({ error: 'O ID do ativo é obrigatório.' });
        }

        // 2. Instancia e executa o UseCase
        const enrichAssetFromLegalOneUseCase = new EnrichAssetFromLegalOneUseCase();

        try {
            // Aciona o UseCase, mas NÃO espera pela sua conclusão com 'await'.
            // Isto permite que a requisição seja respondida imediatamente.
            enrichAssetFromLegalOneUseCase.execute(id);
            
            // 3. Retorna uma resposta 202 (Accepted).
            // Isto informa ao cliente que o pedido foi aceite e está a ser processado.
            return response.status(202).json({ 
                message: 'Processo de enriquecimento de dados iniciado em segundo plano.' 
            });

        } catch (err: any) {
            console.error("❌ Erro ao iniciar o enriquecimento do ativo:", err.message);
            // Este erro só aconteceria se a chamada 'execute' em si falhasse, o que é raro.
            return response.status(500).json({ error: 'Falha ao iniciar o processo de enriquecimento.' });
        }
    }
}

export { EnrichAssetFromLegalOneController };

