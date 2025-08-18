// src/modules/users/useCases/createUser/CreateUserUseCase.ts

import { PrismaClient, User } from "@prisma/client";
import { ManagementClient } from "auth0";
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

const management = new ManagementClient({
    domain: process.env.AUTH0_MGMT_DOMAIN!,
    clientId: process.env.AUTH0_MGMT_CLIENT_ID!,
    clientSecret: process.env.AUTH0_MGMT_CLIENT_SECRET!,
});

type ICreateUserDTO = Pick<
    User,
    'email' | 'name' | 'phone' | 'cellPhone' | 'cpfOrCnpj'
>;

/**
 * @class CreateUserUseCase
 * @description Lógica de negócio para encontrar ou criar um utilizador no Auth0 e sincronizá-lo com o banco de dados local.
 */
class CreateUserUseCase {
    async execute(data: ICreateUserDTO): Promise<User> {
        
        // 1. Validação: Verifica se o e-mail já existe no NOSSO banco de dados.
        const userAlreadyInDb = await prisma.user.findUnique({
            where: { email: data.email },
        });

        if (userAlreadyInDb) {
            throw new Error("Já existe um utilizador com este e-mail no sistema Mazzotini.");
        }

        // 2. A MUDANÇA CRUCIAL: Procura o utilizador no Auth0 pelo e-mail ANTES de criar.
        const existingAuth0Users = await management.usersByEmail.getByEmail({ email: data.email });

        let auth0UserId: string;
        let isNewAuth0User = false;

        // 3. Lógica Condicional: Decide se cria um novo utilizador ou usa um existente.
        if (existingAuth0Users.data.length > 0) {
            // Utilizador já existe no Auth0 (ex: cadastrou-se com Google no site)
            auth0UserId = existingAuth0Users.data[0].user_id!;
            console.log(`[SYNC] Utilizador ${data.email} já existe no Auth0. A usar ID existente: ${auth0UserId}`);
        } else {
            // Utilizador é 100% novo. Criamos a sua identidade no Auth0.
            isNewAuth0User = true;
            const temporaryPassword = `${randomBytes(16).toString('hex')}A1!`;
            const newAuth0User = await management.users.create({
                connection: 'Username-Password-Authentication',
                email: data.email,
                name: data.name,
                password: temporaryPassword,
                email_verified: true,
            });

            if (!newAuth0User.data.user_id) {
                throw new Error("Falha ao criar o utilizador no Auth0.");
            }
            auth0UserId = newAuth0User.data.user_id;
            console.log(`[SYNC] Novo utilizador criado no Auth0 para ${data.email}. ID: ${auth0UserId}`);
        }

        // 4. Criação no Banco de Dados Local
        const newUserInDb = await prisma.user.create({
            data: {
                ...data,
                auth0UserId: auth0UserId,
            },
        });

        // 5. Atribui a role de 'INVESTOR'
        const investorRoleId = process.env.AUTH0_INVESTOR_ROLE_ID;
        if (investorRoleId) {
            await management.roles.assignUsers(
                { id: investorRoleId },
                { users: [auth0UserId] }
            );
            console.log(`✅ Role 'INVESTOR' atribuída ao utilizador ${data.email}`);
        } else {
            console.warn("⚠️ A variável AUTH0_INVESTOR_ROLE_ID não está definida.");
        }

        // 6. Se for um utilizador criado do zero, envia o e-mail de convite/reset de senha.
        if (isNewAuth0User) {
            await management.tickets.changePassword({
                user_id: auth0UserId,
            });
            console.log(`✅ Convite enviado para o novo utilizador: ${data.email}`);
        }
        
        return newUserInDb;
    }
}

export { CreateUserUseCase };
