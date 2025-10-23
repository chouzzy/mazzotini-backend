// /src/modules/users/useCases/listAssociates/ListAssociatesUseCase.ts
import { PrismaClient, User } from "@prisma/client";

const prisma = new PrismaClient();

// O "contrato" de dados que o Controller espera
export type AssociateSummary = {
    id: string;
    name: string;
};

/**
 * @class ListAssociatesUseCase
 * @description Lógica de negócio para buscar todos os utilizadores que podem ser Associados.
 */
class ListAssociatesUseCase {
    async execute(): Promise<AssociateSummary[]> {
        console.log(`[USERS] Buscando lista de todos os utilizadores para o select de Associados...`);

        // TODO: Esta é uma implementação temporária.
        // No futuro, quando as 'roles' estiverem sincronizadas com o nosso banco de dados,
        // devemos filtrar aqui para retornar apenas utilizadores com a role 'ASSOCIATE'.
        // ex: where: { roles: { has: process.env.ROLE_ASSOCIATE } }
        const users = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
            },
            orderBy: {
                name: 'asc'
            }
        });

        console.log(`[USERS] ${users.length} utilizadores/associados encontrados.`);
        return users;
    }
}

export { ListAssociatesUseCase };
