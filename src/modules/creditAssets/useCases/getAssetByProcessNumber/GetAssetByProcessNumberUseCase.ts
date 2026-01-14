import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * @class GetAssetByProcessNumberUseCase
 * @description Lógica de negócio para buscar um ativo pelo número do processo,
 * incluindo suas relações (investidores, associado, atualizações, etc.).
 */
class GetAssetByProcessNumberUseCase {
  async execute(processNumber: string) {
    console.log(`🔍 Buscando detalhes do ativo para o processo: ${processNumber}`);

    // Usamos findUniqueOrThrow para que o Prisma lance um erro se o ativo não for encontrado,
    // o que podemos traduzir para um erro 404 (Not Found) no controller.
    const asset = await prisma.creditAsset.findUniqueOrThrow({
      where: { processNumber },
      // O 'include' é poderoso: ele traz todos os dados relacionados em uma única query.
      include: {
        investors: {
          include: {
            user: { // Para cada investimento, inclua os detalhes do usuário investidor.
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        associate: { // Inclui os detalhes do usuário associado.
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        updates: { // Inclui o histórico de atualizações, ordenado pela data mais recente.
          orderBy: {
            date: 'desc',
          },
        },
        documents: true, // Inclui a lista de documentos.
      },
    });

    console.log(`✅ Ativo encontrado: ${asset.processNumber}`);
    console.log(`Detalhes do ativo:`, asset);
    return asset;
  }
}

export { GetAssetByProcessNumberUseCase };
