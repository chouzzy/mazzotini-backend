// /src/services/auth0ManagementService.ts
import { ManagementClient } from 'auth0';

// Validação das variáveis de ambiente
const auth0Domain = process.env.AUTH0_MGMT_DOMAIN;
const clientId = process.env.AUTH0_MGMT_CLIENT_ID;
const clientSecret = process.env.AUTH0_MGMT_CLIENT_SECRET;

if (!auth0Domain || !clientId || !clientSecret) {
    throw new Error("As credenciais da API de Gestão do Auth0 não estão configuradas no ambiente.");
}

// Instancia o cliente de gestão. A biblioteca lida com a obtenção do token automaticamente.
const managementClient = new ManagementClient({
    domain: auth0Domain,
    clientId: clientId,
    clientSecret: clientSecret,
});

/**
 * @class Auth0ManagementService
 * @description Encapsula toda a comunicação com a API de Gestão do Auth0.
 */
class Auth0ManagementService {
    /**
     * Busca todos os utilizadores no Auth0 e anexa as suas respetivas roles.
     */
    async getUsersWithRoles() {
        console.log("[Auth0 Mgmt] A buscar a lista de todos os utilizadores...");
        const users = await managementClient.users.getAll();

        // Para cada utilizador, buscamos as suas roles em paralelo para otimizar.
        const usersWithRolesPromises = users.data.map(async (user) => {
            if (!user.user_id) {
                return { ...user, roles: [] };
            }
            const rolesResponse = await managementClient.users.getRoles({ id: user.user_id });
            return {
                ...user,
                roles: rolesResponse.data.map(role => role.name) || [], // Retorna apenas os nomes das roles
            };
        });

        const usersWithRoles = await Promise.all(usersWithRolesPromises);
        console.log(`[Auth0 Mgmt] ${usersWithRoles.length} utilizadores encontrados.`);
        
        return usersWithRoles;
    }

    /**
     * Atualiza as roles de um utilizador específico.
     * (Esta função será usada no futuro quando construirmos a edição).
     */
    async updateUserRoles(auth0UserId: string, roleIds: string[]) {
        console.log(`[Auth0 Mgmt] A atualizar roles para o utilizador ${auth0UserId}...`);
        await managementClient.users.assignRoles({ id: auth0UserId }, { roles: roleIds });
        console.log(`[Auth0 Mgmt] Roles atualizadas com sucesso.`);
    }
}

export const auth0ManagementService = new Auth0ManagementService();
