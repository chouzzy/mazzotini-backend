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
    // Adicione outros campos do formulário aqui
>;

/**
 * @class CreateUserUseCase
 * @description Lógica de negócio para criar um novo utilizador no Auth0 e no banco de dados local.
 */
class CreateUserUseCase {
    /**
     * Executa a criação do utilizador.
     * @param {ICreateUserDTO} data - Os dados do utilizador a serem criados.
     * @returns {Promise<User>} O utilizador recém-criado no nosso banco de dados.
     */
    async execute(data: ICreateUserDTO): Promise<User> {
        
        // 1. Validação: Verifica se o e-mail já existe no nosso banco de dados
        const userAlreadyExists = await prisma.user.findUnique({
            where: { email: data.email },
        });

        if (userAlreadyExists) {
            throw new Error("Já existe um utilizador com este e-mail.");
        }

        // 2. Criação no Auth0: Primeiro, criamos o utilizador no sistema de identidade.
        const auth0User = await management.users.create({
            connection: 'Username-Password-Authentication', // Conexão padrão de e-mail/senha
            email: data.email,
            name: data.name,
            password: 'uma-senha-temporaria-muito-forte!123', // O utilizador poderá redefinir depois
            email_verified: true, // Opcional: já marca o e-mail como verificado
        });

        if (!auth0User.data.user_id) {
            throw new Error("Falha ao criar o utilizador no Auth0.");
        }

        // 3. Criação no Banco de Dados Local: Com o ID do Auth0 em mãos, guardamos o registo.
        const newUserInDb = await prisma.user.create({
            data: {
                ...data,
                auth0UserId: auth0User.data.user_id,
            },
        });

        // Opcional: Atribuir a role de 'INVESTOR' ao utilizador no Auth0
        await management.roles.assignUsers(
            { id: 'ID_DA_SUA_ROLE_INVESTOR' }, // TODO: Substituir pelo ID real da role no Auth0
            { users: [auth0User.data.user_id] }
        );

        console.log(`✅ Novo utilizador INVESTOR criado com sucesso: ${data.email}`);
        
        return newUserInDb;
    }
}

export { CreateUserUseCase };
