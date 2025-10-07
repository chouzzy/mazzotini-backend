// /src/services/auth0ManagementService.ts
import { GetOrganizationMemberRoles200ResponseOneOfInner, GetUsers200ResponseOneOfInner, ManagementClient, } from 'auth0';

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
    // ... (os métodos getUsersWithRoles, getAllRoles, updateUserRoles permanecem os mesmos) ...
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

    async getAllRoles(): Promise<GetOrganizationMemberRoles200ResponseOneOfInner[]> {
        console.log("[Auth0 Mgmt] A buscar todas as roles disponíveis...");
        const roles = await managementClient.roles.getAll();
        console.log(`[Auth0 Mgmt] ${roles.data.length} roles encontradas.`);
        return roles.data;
    }

    async updateUserRoles(auth0UserId: string, newRoleNames: string[]): Promise<void> {
        console.log(`[Auth0 Mgmt] A atualizar roles para o utilizador ${auth0UserId} para [${newRoleNames.join(', ')}]`);

        const allRoles = await this.getAllRoles();
        const roleMap = new Map(allRoles.map(role => [role.name, role.id]));

        const newRoleIds = newRoleNames.map(name => {
            const roleId = roleMap.get(name);
            if (!roleId) {
                throw new Error(`A role "${name}" não foi encontrada no Auth0.`);
            }
            return roleId;
        });

        const currentRolesResponse = await managementClient.users.getRoles({ id: auth0UserId });
        const currentRoleIds = currentRolesResponse.data.map(role => role.id!);

        if (newRoleIds.length > 0) {
            await managementClient.users.assignRoles({ id: auth0UserId }, { roles: newRoleIds });
        }
        
        const rolesToRemove = currentRoleIds.filter(id => !newRoleIds.includes(id));
        if(rolesToRemove.length > 0) {
            await managementClient.users.deleteRoles({ id: auth0UserId }, { roles: rolesToRemove });
        }

        console.log(`[Auth0 Mgmt] Roles para ${auth0UserId} atualizadas com sucesso.`);
    }


    /**
     * Cria um novo utilizador no Auth0 e gera um link de "Crie a sua Senha".
     * @returns Um objeto com os dados do novo utilizador e o link para criar a senha.
     */
    async createUserAndGenerateInvite(email: string, name: string): Promise<{ newUser: GetUsers200ResponseOneOfInner, ticketUrl: string }> {
        console.log(`[Auth0 Mgmt] A criar um novo utilizador para ${email}...`);

        // 1. Cria o utilizador SEM senha, mas pede o envio do e-mail de verificação.
        const password = `${email.split('@')[0]}@1234`;
        const newUserResponse = await managementClient.users.create({
            email,
            name,
            connection: 'Username-Password-Authentication',
            password: password, // Defina uma senha temporária
            email_verified: false, // O e-mail de verificação é um passo importante
            verify_email: true,
        });
        
        const newUser = newUserResponse.data;
        if (!newUser.user_id) {
            throw new Error('Falha ao criar o utilizador no Auth0.');
        }

        console.log(`[Auth0 Mgmt] Utilizador ${email} criado. A gerar link de criação de senha...`);

        // 2. Gera um "ticket" para que o utilizador crie a sua primeira senha.
        const ticketResponse = await managementClient.tickets.changePassword({
            user_id: newUser.user_id,
            // Podemos adicionar o nosso URL aqui para uma experiência mais integrada
            // result_url: 'http://mazzotini.awer.co/dashboard', 
        });

        console.log(`[Auth0 Mgmt] Link de criação de senha gerado para ${email}.`);
        
        return { newUser, ticketUrl: ticketResponse.data.ticket };
    }
}

export const auth0ManagementService = new Auth0ManagementService();