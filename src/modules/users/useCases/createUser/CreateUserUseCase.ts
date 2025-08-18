// src/modules/users/useCases/createUser/CreateUserUseCase.ts

import { PrismaClient, User } from "@prisma/client";
import { ManagementClient } from "auth0";

const prisma = new PrismaClient();

// Configura o cliente da API de Gestão do Auth0
const management = new ManagementClient({
    domain: process.env.AUTH0_MGMT_DOMAIN!,
    clientId: process.env.AUTH0_MGMT_CLIENT_ID!,
    clientSecret: process.env.AUTH0_MGMT_CLIENT_SECRET!,
});

// Define a estrutura dos dados que o operador vai inserir no formulário
type ICreateUserDTO = Pick<
    User,
    'email' | 'name' | 'phone' | 'cellPhone' | 'cpfOrCnpj'
>;

/**
 * @class CreateUserUseCase
 * @description Lógica de negócio para criar um novo utilizador e enviar um convite.
 */
class CreateUserUseCase {
    /**
     * Executa a criação do utilizador.
     * @param {ICreateUserDTO} data - Os dados do utilizador a serem criados.
     * @returns {Promise<User>} O utilizador recém-criado no nosso banco de dados.
     */
    async execute(data: ICreateUserDTO): Promise<User> {
        
        const userAlreadyExists = await prisma.user.findUnique({
            where: { email: data.email },
        });

        if (userAlreadyExists) {
            throw new Error("Já existe um utilizador com este e-mail.");
        }

        // 1. Criação no Auth0: Criamos o utilizador SEM SENHA.
        const auth0User = await management.users.create({
            connection: 'Username-Password-Authentication', // Conexão padrão
            email: data.email,
            name: data.name,
            email_verified: true,
        });

        if (!auth0User.data.user_id) {
            throw new Error("Falha ao criar o utilizador no Auth0.");
        }

        // 2. Criação no Banco de Dados Local
        const newUserInDb = await prisma.user.create({
            data: {
                ...data,
                auth0UserId: auth0User.data.user_id,
            },
        });

        // 3. Atribui a role de 'INVESTOR'
        const investorRoleId = process.env.AUTH0_INVESTOR_ROLE_ID;
        if (investorRoleId) {
            await management.roles.assignUsers(
                { id: investorRoleId },
                { users: [auth0User.data.user_id] }
            );
            console.log(`✅ Role 'INVESTOR' atribuída ao utilizador ${data.email}`);
        } else {
            console.warn("⚠️ A variável AUTH0_INVESTOR_ROLE_ID não está definida.");
        }

        // 4. A MÁGICA: Gera um link de redefinição de senha, que funciona como um convite.
        await management.tickets.changePassword({
            user_id: auth0User.data.user_id,
            // Opcional: pode incluir o nome da organização, e-mail do remetente, etc.
        });
        
        console.log(`✅ Novo utilizador INVESTOR criado e convite enviado para: ${data.email}`);
        
        return newUserInDb;
    }
}

export { CreateUserUseCase };
