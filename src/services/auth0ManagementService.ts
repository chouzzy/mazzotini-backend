// /src/services/auth0ManagementService.ts
import { User } from '@prisma/client';
import { GetOrganizationMemberRoles200ResponseOneOfInner, GetRoleUser200ResponseOneOfInner, GetUsers200ResponseOneOfInner, ManagementClient } from 'auth0';
import { randomBytes } from 'crypto';

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
        if (rolesToRemove.length > 0) {
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

        // Gera uma senha temporária e segura que nunca será usada pelo utilizador
        const randomPassword = `${randomBytes(16).toString('hex')}A1!`;

        const newUserResponse = await managementClient.users.create({
            email,
            name,
            connection: 'Username-Password-Authentication',
            password: randomPassword,
            email_verified: false,
            verify_email: true,
        });

        const newUser = newUserResponse.data;
        if (!newUser.user_id) {
            throw new Error('Falha ao criar o utilizador no Auth0.');
        }

        console.log(`[Auth0 Mgmt] Utilizador ${email} criado. A gerar link de criação de senha...`);

        // Gera um "ticket" para que o utilizador crie a sua primeira senha.
        const ticketResponse = await managementClient.tickets.changePassword({
            user_id: newUser.user_id,
            // Opcional: para onde redirecionar o utilizador após criar a senha
            // result_url: 'http://mazzotini.awer.co/dashboard', 
        });

        console.log(`[Auth0 Mgmt] Link de criação de senha gerado para ${email}.`);

        return { newUser, ticketUrl: ticketResponse.data.ticket };
    }

    /**
 * Pede ao Auth0 para reenviar o e-mail de verificação para um utilizador.
 */
    async resendVerificationEmail(auth0UserId: string): Promise<void> {
        console.log(`[Auth0 Mgmt] A solicitar reenvio de e-mail de verificação para ${auth0UserId}...`);

        await managementClient.jobs.verifyEmail({
            user_id: auth0UserId,
        });

        console.log(`[Auth0 Mgmt] Pedido de reenvio para ${auth0UserId} enviado com sucesso.`);
    }

    async getUsersByRole(roleName: string): Promise<GetRoleUser200ResponseOneOfInner[]> {
        console.log(`[Auth0 Mgmt] A buscar utilizadores com a role: ${roleName}`);

        // 1. Primeiro, precisamos do ID da role
        const allRoles = await this.getAllRoles();
        const associateRole = allRoles.find(r => r.name === roleName);

        if (!associateRole || !associateRole.id) {
            console.warn(`[Auth0 Mgmt] A role ${roleName} não foi encontrada no Auth0.`);
            return [];
        }

        // 2. Busca os utilizadores que têm esse ID de role
        const usersResponse = await managementClient.roles.getUsers({ id: associateRole.id });
        
        console.log(`[Auth0 Mgmt] ${usersResponse.data.length} utilizadores encontrados com a role ${roleName}.`);
        return usersResponse.data;
    }

}

export const auth0ManagementService = new Auth0ManagementService();




