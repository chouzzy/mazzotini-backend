// /src/modules/users/useCases/listUsers/ListUsersUseCase.ts
import { PrismaClient, User } from '@prisma/client';
import { auth0ManagementService } from '../../../../services/auth0ManagementService'; // Precisamos das roles!

const prisma = new PrismaClient();

// Definimos o tipo de retorno completo com todos os dados
export type UserFullDetails = {
    id: string; // ID do nosso banco
    auth0UserId: string; // ID do Auth0
    name: string;
    email: string;
    profilePictureUrl?: string | null;
    lastLogin?: string;
    roles: (string | undefined)[];
};

class ListUsersUseCase {
    async execute(): Promise<UserFullDetails[]> {
        console.log("🔍 Buscando todos os usuários (lógica unificada)...");

        // 1. Busca todos os nossos utilizadores locais
        const localUsers = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                profilePictureUrl: true,
                auth0UserId: true,
            },
            orderBy: { name: 'asc' },
        });

        // 2. Busca os dados de roles e último login do Auth0
        const auth0Users = await auth0ManagementService.getUsersWithRoles();

        // 3. Cria um "mapa" de dados do Auth0 para performance
        const auth0UserMap = new Map(auth0Users.map(u => [u.email, u]));

        // 4. Combina os dados
        const fullDetailsUsers = localUsers.map(localUser => {
            const auth0Data = auth0UserMap.get(localUser.email);
            
            return {
                id: localUser.id,
                auth0UserId: localUser.auth0UserId,
                name: localUser.name, // O nome do nosso DB é a fonte da verdade
                email: localUser.email,
                profilePictureUrl: localUser.profilePictureUrl, // A foto do nosso DB
                lastLogin: auth0Data?.last_login?.toString(),
                roles: auth0Data?.roles || []
            };
        });

        console.log(`✅ ${fullDetailsUsers.length} usuários encontrados e enriquecidos.`);
        return fullDetailsUsers;
    }
}

export { ListUsersUseCase };
