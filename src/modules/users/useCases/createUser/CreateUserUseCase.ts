// src/modules/users/useCases/createUser/CreateUserUseCase.ts
// Renomeado mentalmente para SyncUserUseCase, mas mantendo o nome do ficheiro para consistência

import { PrismaClient, User } from "@prisma/client";
import { ManagementClient } from "auth0";

const prisma = new PrismaClient();

// Configura o cliente da API de Gestão do Auth0 (necessário para atribuir a role)
const management = new ManagementClient({
    domain: process.env.AUTH0_MGMT_DOMAIN!,
    clientId: process.env.AUTH0_MGMT_CLIENT_ID!,
    clientSecret: process.env.AUTH0_MGMT_CLIENT_SECRET!,
});

// Define a estrutura dos dados que esperamos receber da Action do Auth0.
// Exatamente como você mostrou no seu prompt.
type ISyncUserDTO = {
    email: string;
    auth0UserId: string;
    name: string;
    phone?: string;
    cellPhone?: string;
    cpfOrCnpj?: string;
};

/**
 * @class CreateUserUseCase
 * @description Lógica de negócio para SINCRONIZAR um novo utilizador do Auth0 com o banco de dados local.
 */
class CreateUserUseCase {
    /**
     * Executa a sincronização do utilizador.
     * @param {ISyncUserDTO} data - Os dados do utilizador vindos da Action do Auth0.
     * @returns {Promise<User>} O utilizador recém-criado ou já existente no nosso banco de dados.
     */
    async execute({ email, auth0UserId, name, phone, cellPhone, cpfOrCnpj }: ISyncUserDTO): Promise<User> {

        // 1. Validação: Verifica se um utilizador com este auth0UserId já foi sincronizado.
        // Isto torna a operação segura contra chamadas de webhook duplicadas.
        const userAlreadyExists = await prisma.user.findUnique({
            where: { email },
        });

        if (userAlreadyExists) {
            console.log(`[SYNC] Utilizador ${email} já existe no banco de dados. Nenhuma ação necessária.`);
            return userAlreadyExists;
        }

        // 2. Criação: Se o utilizador for novo para o nosso sistema, cria o registo local.
        // Não criamos mais utilizadores no Auth0 a partir daqui, apenas espelhamos o que já foi criado.
        const newUserInDb = await prisma.user.create({
            data: {
                email,
                auth0UserId,
                name: name || email, // Usa o nome vindo do Auth0, ou o e-mail como fallback
                phone: phone || null, // Inicialmente nulo, pode ser atualizado depois
                cellPhone: cellPhone || null,
                cpfOrCnpj: cpfOrCnpj || null,
            },
        });

        // 3. Atribui a role de 'INVESTOR' automaticamente a cada novo utilizador que se regista.
        const investorRoleId = process.env.AUTH0_INVESTOR_ROLE_ID;
        if (investorRoleId) {
            try {
                await management.roles.assignUsers(
                    { id: investorRoleId },
                    { users: [auth0UserId] }
                );
                console.log(`✅ Role 'INVESTOR' atribuída automaticamente ao novo utilizador ${email}`);
            } catch (error) {
                console.error(`❌ Erro ao atribuir role ao utilizador ${auth0UserId}:`, error);
                // Continua mesmo se a atribuição da role falhar, para não quebrar o fluxo principal.
            }
        } else {
            console.warn("⚠️ A variável AUTH0_INVESTOR_ROLE_ID não está definida. A role não foi atribuída.");
        }

        console.log(`✅ Novo utilizador sincronizado com sucesso: ${email}`);
        
        return newUserInDb;
    }
}

export { CreateUserUseCase };
