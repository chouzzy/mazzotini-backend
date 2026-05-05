import { prisma } from '../../../../prisma';
// src/modules/investments/useCases/listMyInvestments/ListMyInvestmentsUseCase.ts





// Definimos uma interface para o nosso retorno, incluindo o objeto do ativo.
// O Prisma vai nos dar isso automaticamente com o 'include'.
export type InvestmentWithAsset = Investment & {
  asset: {
    processNumber: string;
    originalCreditor: string;
    status: string;
    acquisitionDate: Date;
    acquisitionValue: number;
    currentValue: number;
    updateIndexType: string | null;
  };
};

class ListMyInvestmentsUseCase {
  /**
   * Executa a busca por todos os investimentos de um usuário específico.
   * @param auth0UserId O ID do usuário vindo do token Auth0.
   */
  async execute(auth0UserId: string): Promise<InvestmentWithAsset[]> {
    console.log(`🔍 Buscando investimentos para o usuário com Auth0 ID: ${auth0UserId}`);

    const investments = await prisma.investment.findMany({
      // A condição de busca: queremos investimentos onde o 'user' relacionado
      // tenha o 'auth0UserId' que recebemos.
      where: {
        user: {
          auth0UserId: auth0UserId,
        },
      },
      // Usamos 'include' para que o Prisma traga o Ativo de Crédito (CreditAsset)
      // relacionado a cada investimento na mesma consulta. Super eficiente!
      include: {
        asset: {
          select: {
            processNumber: true,
            originalCreditor: true,
            status: true,
            acquisitionDate: true,
            acquisitionValue: true,
            currentValue: true,
            updateIndexType: true,
          }
        },
      },
      orderBy: {
        asset: {
          acquisitionDate: 'desc'
        }
      }
    });

    if (!investments || investments.length === 0) {
      console.log(`🤷 Nenhum investimento encontrado para o usuário ${auth0UserId}.`);
      return [];
    }

    console.log(`✅ ${investments.length} investimentos encontrados.`);
    return investments as InvestmentWithAsset[];
  }
}

export { ListMyInvestmentsUseCase };