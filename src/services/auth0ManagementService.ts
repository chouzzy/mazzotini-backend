// /src/services/auth0ManagementService.ts
import { ApiResponse, GetOrganizationMemberRoles200ResponseOneOfInner, ManagementClient, RoleCreate } from 'auth0';

// Validação das variáveis de ambiente
const auth0Domain = process.env.AUTH0_MGMT_DOMAIN;
const clientId = process.env.AUTH0_MGMT_CLIENT_ID;
const clientSecret = process.env.AUTH0_MGMT_CLIENT_SECRET;

if (!auth0Domain || !clientId || !clientSecret) {
    throw new Error("As credenciais da API de Gestão do Auth0 não estão configuradas no ambiente.");
}

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

        const usersWithRolesPromises = users.data.map(async (user) => {
            if (!user.user_id) {
                return { ...user, roles: [] };
            }
            const rolesResponse = await managementClient.users.getRoles({ id: user.user_id });
            return {
                ...user,
                roles: rolesResponse.data.map(role => role.name) || [],
            };
        });

        const usersWithRoles = await Promise.all(usersWithRolesPromises);
        console.log(`[Auth0 Mgmt] ${usersWithRoles.length} utilizadores encontrados.`);
        
        return usersWithRoles;
    }

    /**
     * Busca todas as roles disponíveis no Auth0.
     */
    async getAllRoles(): Promise<ApiResponse<GetOrganizationMemberRoles200ResponseOneOfInner[]>["data"]> {
        console.log("[Auth0 Mgmt] A buscar todas as roles disponíveis...");
        const roles = await managementClient.roles.getAll();
        console.log(`[Auth0 Mgmt] ${roles.data.length} roles encontradas.`);
        return roles.data;
    }

    /**
     * Atualiza as roles de um utilizador específico, recebendo os NOMES das roles.
     */
    async updateUserRoles(auth0UserId: string, newRoleNames: string[]): Promise<void> {
        console.log(`[Auth0 Mgmt] A atualizar roles para o utilizador ${auth0UserId} para [${newRoleNames.join(', ')}]`);

        // Passo 1: Buscar todas as roles disponíveis para criar um mapa de Nome -> ID.
        const allRoles = await this.getAllRoles();
        const roleMap = new Map(allRoles.map(role => [role.name, role.id]));

        // Passo 2: Converter os nomes das novas roles para os seus IDs correspondentes.
        const newRoleIds = newRoleNames.map(name => {
            const roleId = roleMap.get(name);
            if (!roleId) {
                throw new Error(`A role "${name}" não foi encontrada no Auth0.`);
            }
            return roleId;
        });

        // Passo 3: Buscar as roles atuais do utilizador para saber o que remover.
        const currentRolesResponse = await managementClient.users.getRoles({ id: auth0UserId });
        const currentRoleIds = currentRolesResponse.data.map(role => role.id!);

        // Passo 4: Atribuir as novas roles e remover as antigas numa única operação.
        await managementClient.users.assignRoles({ id: auth0UserId }, { roles: newRoleIds });
        
        // Determina quais roles antigas não estão na nova lista para serem removidas.
        const rolesToRemove = currentRoleIds.filter(id => !newRoleIds.includes(id));
        if(rolesToRemove.length > 0) {
            await managementClient.users.deleteRoles({ id: auth0UserId }, { roles: rolesToRemove });
        }

        console.log(`[Auth0 Mgmt] Roles para ${auth0UserId} atualizadas com sucesso.`);
    }
}

export const auth0ManagementService = new Auth0ManagementService();
