// /src/services/auth0ManagementService.ts
import { GetOrganizationMemberRoles200ResponseOneOfInner, GetUsers200ResponseOneOfInner, ManagementClient } from 'auth0';
import { randomBytes } from 'crypto'; // 1. Importe o módulo 'crypto' do Node.js

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
    async getAllRoles(): Promise<GetOrganizationMemberRoles200ResponseOneOfInner[]> {
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
        if (newRoleIds.length > 0) {
            await managementClient.users.assignRoles({ id: auth0UserId }, { roles: newRoleIds });
        }

        const rolesToRemove = currentRoleIds.filter(id => !newRoleIds.includes(id));
        if (rolesToRemove.length > 0) {
            await managementClient.users.deleteRoles({ id: auth0UserId }, { roles: rolesToRemove });
        }

        console.log(`[Auth0 Mgmt] Roles para ${auth0UserId} atualizadas com sucesso.`);
    }

    
    async createUser(email: string, name: string): Promise<GetUsers200ResponseOneOfInner> {
        console.log(`[Auth0 Mgmt] A criar um novo utilizador para ${email}...`);
        const newUser = await managementClient.users.create({
            email,
            name,
            connection: 'Username-Password-Authentication', // A sua conexão de base de dados padrão
            password: `${email.split('@')[0]}@1234`,
            email_verified: false, // O e-mail de verificação funcionará como o convite
            verify_email: true,    // Garante que o e-mail seja enviado
        });
        console.log(`[Auth0 Mgmt] Utilizador ${email} criado com sucesso com o ID: ${newUser.data.user_id}, senha temporária: ${email.split('@')[0]}@1234`);
        return newUser.data;
    }
}

export const auth0ManagementService = new Auth0ManagementService();

