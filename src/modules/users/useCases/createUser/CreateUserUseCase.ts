// src/modules/users/useCases/createUser/CreateUserUseCase.ts

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
type ISyncUserDTO = {
    email: string;
    auth0UserId: string;
    name: string;
    phone?: string;
    cellPhone?: string;
    cpfOrCnpj?: string;
    role?: string; // Adicionado para suportar a lógica de associado
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
    async execute({ email, auth0UserId, name, phone, cellPhone, cpfOrCnpj, role }: ISyncUserDTO): Promise<User> {

        // 1. Validação: Verifica se um utilizador com este e-mail já foi sincronizado.
        const userAlreadyExists = await prisma.user.findUnique({
            where: { email },
        });

        if (userAlreadyExists) {
            console.log(`[SYNC] Utilizador ${email} já existe no banco de dados. Nenhuma ação necessária.`);
            return userAlreadyExists;
        }

        // =================================================================
        // 2. Lógica de Geração de Código para Associados
        // =================================================================
        let associateSequence: number | null = null;

        // Se o utilizador estiver a ser criado como ASSOCIATE, gera o próximo número da sequência
        if (role === 'ASSOCIATE') {
            const lastAssociate = await prisma.user.findFirst({
                where: { associateSequence: { not: null } },
                orderBy: { associateSequence: 'desc' },
                select: { associateSequence: true }
            });

            // Se não houver nenhum, começa com 1. Se houver, soma 1 ao maior valor.
            associateSequence = (lastAssociate?.associateSequence || 0) + 1;
            console.log(`[SYNC] Gerando sequência para novo associado: ${associateSequence}`);
        }
        // =================================================================

        // 3. Criação: Cria o registo local espelhando os dados do Auth0.
        const newUserInDb = await prisma.user.create({
            data: {
                email,
                auth0UserId,
                name: name || email,
                phone: phone || null,
                cellPhone: cellPhone || null,
                cpfOrCnpj: cpfOrCnpj || null,
                role: (role as any) || 'INVESTOR',
                associateSequence, // Grava o código gerado ou null
            },
        });

        // 4. Atribui a role no Auth0 se for um novo utilizador (padrão INVESTOR se não especificado)
        const investorRoleId = process.env.AUTH0_INVESTOR_ROLE_ID;
        // Só atribuímos automaticamente se não foi passado uma role específica ou se for explicitamente INVESTOR
        if (!role || role === 'INVESTOR') {
            if (investorRoleId) {
                try {
                    await management.roles.assignUsers(
                        { id: investorRoleId },
                        { users: [auth0UserId] }
                    );
                    console.log(`✅ Role 'INVESTOR' atribuída automaticamente ao novo utilizador ${email}`);
                } catch (error) {
                    console.error(`❌ Erro ao atribuir role ao utilizador ${auth0UserId}:`, error);
                }
            } else {
                console.warn("⚠️ A variável AUTH0_INVESTOR_ROLE_ID não está definida.");
            }
        }

        console.log(`✅ Novo utilizador sincronizado com sucesso: ${email} (Seq: ${associateSequence || 'N/A'})`);
        
        return newUserInDb;
    }
}

export { CreateUserUseCase };