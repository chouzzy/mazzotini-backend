// /src/modules/management/useCases/listUsers/ListManagementUsersUseCase.ts
import { auth0ManagementService } from "../../../../services/auth0ManagementService";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Tipagem para o formato que enviaremos ao frontend
export type UserManagementInfo = {
    auth0UserId: string;
    email: string;
    name: string; // Virá do nosso DB (fonte da verdade)
    picture: string; // Foto do Auth0 (fallback)
    profilePictureUrl?: string | null; // Foto do nosso DB (prioridade)
    lastLogin?: string;
    roles: (string | undefined)[];
};

/**
 * @class ListManagementUsersUseCase
 * @description Lógica de negócio para buscar e formatar a lista de utilizadores para gestão.
 */
class ListManagementUsersUseCase {
    async execute(): Promise<UserManagementInfo[]> {
        // 1. Busca todos os utilizadores no Auth0 (como antes)
        const usersFromAuth0 = await auth0ManagementService.getUsersWithRoles();
        
        // 2. Extrai os IDs do Auth0 para buscar os nossos perfis locais
        const auth0UserIds = usersFromAuth0
            .map(u => u.user_id)
            .filter(id => id) as string[];

        // 3. Busca todos os perfis correspondentes no nosso banco de dados local
        const localUsers = await prisma.user.findMany({
            where: {
                auth0UserId: { in: auth0UserIds }
            },
            select: {
                auth0UserId: true,
                name: true,
                profilePictureUrl: true,
            }
        });

        // 4. Cria um "mapa" para facilitar a consulta (prática sénior de performance)
        const localUserMap = new Map(localUsers.map(u => [u.auth0UserId, u]));

        // 5. Enriquece os dados do Auth0 com os dados do nosso banco
        const formattedUsers = usersFromAuth0.map(auth0User => {
            const localProfile = localUserMap.get(auth0User.user_id!);
            
            return {
                auth0UserId: auth0User.user_id || 'N/A',
                email: auth0User.email || 'N/A',
                // Fonte da verdade: usa o nome do nosso DB; se não existir, usa o do Auth0
                name: localProfile?.name || auth0User.name || 'N/A',
                picture: auth0User.picture || '',
                // Fonte da verdade: envia a foto do nosso DB
                profilePictureUrl: localProfile?.profilePictureUrl,
                lastLogin: auth0User.last_login ? String(auth0User.last_login) : undefined,
                roles: auth0User.roles || [],
            };
        });

        return formattedUsers;
    }
}

export { ListManagementUsersUseCase };
