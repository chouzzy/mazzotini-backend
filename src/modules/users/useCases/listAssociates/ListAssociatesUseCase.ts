// /src/modules/users/useCases/listAssociates/ListAssociatesUseCase.ts
import { PrismaClient } from "@prisma/client";
import { auth0ManagementService } from "../../../../services/auth0ManagementService";

const prisma = new PrismaClient();

// O "contrato" de dados que o Controller espera
export type AssociateSummary = {
    id: string; // O ID do nosso banco de dados
    name: string;
};

// Lê a role das variáveis de ambiente
const ROLE_ASSOCIATE = process.env.ROLE_ASSOCIATE || 'ASSOCIATE';

/**
 * @class ListAssociatesUseCase
 * @description Lógica de negócio para buscar todos os utilizadores com a role 'ASSOCIATE'.
 */
class ListAssociatesUseCase {
    async execute(): Promise<AssociateSummary[]> {
        console.log(`[USERS] Buscando lista de utilizadores com a role: ${ROLE_ASSOCIATE}`);

        // 1. Busca no Auth0 todos os utilizadores que SÃO associados
        const associatesFromAuth0 = await auth0ManagementService.getUsersByRole(ROLE_ASSOCIATE);
        
        if (!associatesFromAuth0 || associatesFromAuth0.length === 0) {
            console.log(`[USERS] Nenhum utilizador encontrado com a role ${ROLE_ASSOCIATE} no Auth0.`);
            return [];
        }

        // 2. Extrai os emails ou auth0UserIds para encontrar no nosso banco
        const associateAuth0Ids = associatesFromAuth0.map(u => u.user_id).filter(Boolean) as string[];

        // 3. Busca no nosso banco de dados local APENAS os utilizadores que são associados
        const localUsers = await prisma.user.findMany({
            where: {
                auth0UserId: { in: associateAuth0Ids }
            },
            select: {
                id: true, // O ID do nosso banco (MongoDB)
                name: true,
            },
            orderBy: {
                name: 'asc'
            }
        });

        console.log(`[USERS] ${localUsers.length} associados encontrados e validados no banco local.`);
        return localUsers;
    }
}

export { ListAssociatesUseCase };

