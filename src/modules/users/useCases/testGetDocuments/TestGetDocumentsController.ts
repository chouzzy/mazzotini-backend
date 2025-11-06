import { Request, Response } from 'express';
import { legalOneApiService } from '../../../../services/legalOneApiService';

class TestGetDocumentsController {
    async handle(request: Request, response: Response): Promise<Response> {
        const { lawsuitId } = request.params;

        if (!lawsuitId) {
            return response.status(400).json({ error: 'O lawsuitId é obrigatório.' });
        }

        try {
            console.log(`[SPY] Recebida requisição para espionar documentos do Lawsuit ID: ${lawsuitId}`);
            // Usamos o 'any' aqui de propósito para capturar a *estrutura completa*
            // que a API retorna, não apenas o que definimos na nossa interface.
            const rawDocuments: any[] = await legalOneApiService.getRawDocuments(Number(lawsuitId));
            
            console.log(`[SPY] Documentos encontrados: ${rawDocuments.length}`);
            
            if (rawDocuments.length === 0) {
                return response.status(404).json({ message: 'Nenhum documento encontrado para este processo.' });
            }

            // Retorna o JSON completo do primeiro documento encontrado
            return response.status(200).json(rawDocuments[0]);

        } catch (err: any) {
            console.error(`[SPY] Erro ao espionar documentos:`, err.message);
            if (err.response && err.response.data) {
                console.error("[SPY] Resposta de erro detalhada:", JSON.stringify(err.response.data, null, 2));
            }
            return response.status(500).json({ error: err.message, details: err.response?.data || null });
        }
    }
}

export { TestGetDocumentsController };