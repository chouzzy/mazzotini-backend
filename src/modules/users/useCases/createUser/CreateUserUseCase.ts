// src/modules/users/useCases/createUser/CreateUserUseCase.ts
// Renomeado mentalmente para SyncUserUseCase, mas mantendo o nome do ficheiro para consistência

import { PrismaClient, User } from "@prisma/client";
import { ManagementClient } from "auth0";

const prisma = new PrismaClient();

// Configura o cliente da API de Gestão do Auth0
const management = new ManagementClient({
    domain: process.env.AUTH0_MGMT_DOMAIN!,
    clientId: process.env.AUTH0_MGMT_CLIENT_ID!,
    clientSecret: process.env.AUTH0_MGMT_CLIENT_SECRET!,
});

// Define a estrutura dos dados que esperamos receber da Action do Auth0.
type ISyncUserDTO = Pick<
    User,
    'email' | 'auth0UserId' | 'name'
>;

/**
 * @class CreateUserUseCase
 * @description Lógica de negócio para sincronizar um novo utilizador do Auth0 com o banco de dados local.
 */
class CreateUserUseCase {
    /**
     * Executa a sincronização do utilizador.
     * @param {ISyncUserDTO} data - Os dados do utilizador vindos do Auth0.
     * @returns {Promise<User>} O utilizador recém-criado ou já existente no nosso banco de dados.
     */
    async execute({ email, auth0UserId, name }: ISyncUserDTO): Promise<User> {
        
        // 1. Validação: Verifica se um utilizador com este auth0UserId já existe no nosso DB.
        const userAlreadyExists = await prisma.user.findUnique({
            where: { auth0UserId },
        });

        if (userAlreadyExists) {
            console.log(`[SYNC] Utilizador ${email} já existe no banco de dados. Nenhuma ação necessária.`);
            return userAlreadyExists;
        }

        // 2. Criação: Se o utilizador for novo para o nosso sistema, cria o registo local.
        const newUserInDb = await prisma.user.create({
            data: {
                email,
                auth0UserId,
                name: name || email, // Usa o nome vindo do Auth0, ou o e-mail como fallback
            },
        });

        // 3. Atribui a role de 'INVESTOR' automaticamente a cada novo utilizador
        const investorRoleId = process.env.AUTH0_INVESTOR_ROLE_ID;
        if (investorRoleId) {
            await management.roles.assignUsers(
                { id: investorRoleId },
                { users: [auth0UserId] }
            );
            console.log(`✅ Role 'INVESTOR' atribuída automaticamente ao novo utilizador ${email}`);
        } else {
            console.warn("⚠️ A variável AUTH0_INVESTOR_ROLE_ID não está definida. A role não foi atribuída.");
        }

        console.log(`✅ Novo utilizador sincronizado com sucesso: ${email}`);
        
        return newUserInDb;
    }
}

export { CreateUserUseCase };
