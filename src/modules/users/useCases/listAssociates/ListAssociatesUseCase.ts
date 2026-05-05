import { prisma } from '../../../../prisma';
// /src/modules/users/useCases/listAssociates/ListAssociatesUseCase.ts




// O "contrato" de dados que o Controller espera
export type AssociateSummary = {
    id: string;
    name: string;
    associateSequence: number | null;
    email: string;
    role: string;
};

/**
 * @class ListAssociatesUseCase
 * @description Busca todos os usuários com role ASSOCIATE diretamente no banco.
 *
 * Antes, essa consulta passava pela Auth0 Management API para obter os IDs
 * e depois cruzava com o banco — o que quebrava quando o Auth0 retornava vazio
 * por rate limit ou por usuários ainda não sincronizados.
 *
 * O banco local é a fonte da verdade para roles internas, então a consulta
 * vai direto para o Prisma.
 */
class ListAssociatesUseCase {
    async execute(): Promise<AssociateSummary[]> {
        console.log(`[USERS] Buscando associados no banco local...`);

        const associates = await prisma.user.findMany({
            where: { role: 'ASSOCIATE' },
            select: {
                id: true,
                name: true,
                associateSequence: true,
                email: true,
                role: true
            },
            orderBy: { name: 'asc' }
        });

        console.log(`[USERS] ${associates.length} associados encontrados.`);
        return associates;
    }
}

export { ListAssociatesUseCase };

