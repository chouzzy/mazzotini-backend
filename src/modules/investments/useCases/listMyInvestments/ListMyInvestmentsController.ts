// src/modules/investments/useCases/listMyInvestments/ListMyInvestmentsController.ts

import { Request, Response } from 'express';
import { ListMyInvestmentsUseCase } from './ListMyInvestmentsUseCase';

class ListMyInvestmentsController {
  async handle(request: any, response: Response): Promise<Response> {
    const listMyInvestmentsUseCase = new ListMyInvestmentsUseCase();

    try {
      // O 'checkJwt' middleware já validou o token e adicionou o payload ao 'request.auth'.
      // O 'sub' (subject) é o ID único do usuário no Auth0.
      const auth0UserId = request.auth?.payload.sub;

      if (!auth0UserId) {
        return response.status(401).json({ error: 'ID de usuário não encontrado no token.' });
      }

      const investments = await listMyInvestmentsUseCase.execute(auth0UserId);

      // Etapa crucial: Mapear os dados do banco para o formato que o frontend precisa.
      // Aqui calculamos os valores proporcionais à participação do investidor.
      const formattedInvestments = investments.map(inv => {
        const investorShareDecimal = inv.investorShare / 100;
        
        return {
          processNumber: inv.asset.processNumber,
          originalCreditor: inv.asset.originalCreditor,
          status: inv.asset.status,
          acquisitionDate: inv.asset.acquisitionDate,
          investorShare: inv.investorShare,
          updateIndexType: inv.asset.updateIndexType || 'N/A',
          
          // Calcula o valor que o investidor de fato pagou.
          investedValue: inv.asset.acquisitionValue * investorShareDecimal,
          
          // Calcula o valor atual da parte do investidor.
          currentValue: inv.asset.currentValue * investorShareDecimal,
        };
      });

      return response.status(200).json(formattedInvestments);

    } catch (err: any) {
      console.error("❌ Erro ao listar investimentos:", err.message);
      return response.status(500).json({ error: 'Erro interno ao buscar investimentos.' });
    }
  }
}

export { ListMyInvestmentsController };