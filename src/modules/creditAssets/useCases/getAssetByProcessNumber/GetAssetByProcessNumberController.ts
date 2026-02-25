import { Request, Response } from 'express';
import { GetAssetByProcessNumberUseCase } from './GetAssetByProcessNumberUseCase';

/**
 * @class GetAssetByProcessNumberController
 * @description Lida com a requisição HTTP para buscar os detalhes de um ativo.
 */
class GetAssetByProcessNumberController {
  async handle(request: Request, response: Response): Promise<Response> {
    const processNumber = request.params.processNumber as string;
    const getAssetUseCase = new GetAssetByProcessNumberUseCase();

    try {
      const asset = await getAssetUseCase.execute(processNumber);
      return response.status(200).json(asset);

    } catch (err: any) {
      // O erro 'P2025' é o código do Prisma para "registro não encontrado" com findUniqueOrThrow.
      if (err.code === 'P2025') {
        return response.status(404).json({ error: 'Ativo de crédito não encontrado.' });
      }
      
      console.error("❌ Erro ao buscar detalhes do ativo:", err.message);
      return response.status(500).json({ error: 'Erro interno ao buscar o ativo.' });
    }
  }
}

export { GetAssetByProcessNumberController };