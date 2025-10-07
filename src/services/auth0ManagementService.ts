// /src/services/auth0ManagementService.ts
import { AuthenticationClient, GetOrganizationMemberRoles200ResponseOneOfInner, GetUsers200ResponseOneOfInner, ManagementClient} from 'auth0';

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

// 2. INSTANCIE o novo "Rececionista": para fluxos de autenticação
const authenticationClient = new AuthenticationClient({
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
     * Cria um novo utilizador e pede ao Auth0 para enviar um e-mail de "Login por Link Mágico".
     * @returns O objeto do novo utilizador criado.
     */
    async createUserAndSendMagicLink(email: string, name: string): Promise<GetUsers200ResponseOneOfInner> {
        console.log(`[Auth0 Mgmt] A criar um novo utilizador para ${email}...`);

        // 1. Cria o utilizador SEM senha.
        const newUserResponse = await managementClient.users.create({
            email,
            name,
            connection: 'Username-Password-Authentication', // A conexão padrão de e-mail/senha
            email_verified: false, // O e-mail de verificação ainda é importante
        });
        
        const newUser = newUserResponse.data;
        if (!newUser.user_id) {
            throw new Error('Falha ao criar o utilizador no Auth0.');
        }

        console.log(`[Auth0 Mgmt] Utilizador ${email} criado. A solicitar envio de Link Mágico...`);

        // 2. O "Rececionista" envia o e-mail de login sem senha
        await authenticationClient.passwordless.sendEmail({
            email,
            send: 'link',
            authParams: {
                redirect_uri: process.env.FRONT_END_URL,
                audience: process.env.AUTH0_AUDIENCE,
                scope: 'openid profile email',
                response_type: 'code',
            },
        });

        console.log(`[Auth0 Mgmt] Pedido de Link Mágico para ${email} enviado com sucesso.`);
        
        return newUser;
    }
}

export const auth0ManagementService = new Auth0ManagementService();

