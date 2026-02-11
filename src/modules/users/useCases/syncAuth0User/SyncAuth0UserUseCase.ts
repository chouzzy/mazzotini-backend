import { PrismaClient, User } from "@prisma/client";

const prisma = new PrismaClient();

interface IRequest {
    auth0UserId: string;
    email: string;
    name: string;
    picture: string;
}

class SyncAuth0UserUseCase {
    async execute({ auth0UserId, email, name, picture }: IRequest): Promise<User> {
        console.log(`[SYNC AUTH0] Sincronizando usuário: ${email} (${auth0UserId})`);

        // 1. Tenta encontrar pelo Auth0 ID (Usuário já logado antes)
        let user = await prisma.user.findUnique({
            where: { auth0UserId }
        });

        if (user) {
            // Já existe e já está vinculado corretamente.
            // Atualiza apenas dados básicos se necessário (ex: foto nova no google)
            // (Opcional: atualizar lastLoginAt)
            return user;
        }

        // 2. Tenta encontrar pelo E-MAIL (Cenário Shadow User)
        // Aqui acontece a mágica do "Merge"
        const shadowUser = await prisma.user.findFirst({
            where: { email: email } // Busca por email
        });

        if (shadowUser) {
            console.log(`[SYNC AUTH0] Usuário Sombra encontrado para ${email}. Realizando MERGE de contas...`);
            console.log(`[SYNC AUTH0] Trocando ID ${shadowUser.auth0UserId} -> ${auth0UserId}`);

            // ATUALIZA O USUÁRIO EXISTENTE
            // Substitui o ID temporário (legalone|...) pelo ID real do Auth0 (google|...)
            user = await prisma.user.update({
                where: { id: shadowUser.id },
                data: {
                    auth0UserId: auth0UserId, // <--- O Pulo do Gato
                    profilePictureUrl: picture, // Atualiza a foto que veio do social
                    // Mantém os outros dados (endereço, CPF) que vieram do Legal One
                }
            });

            return user;
        }

        // 3. Se não achou nem por ID nem por Email, cria um novo do zero
        console.log(`[SYNC AUTH0] Novo usuário detectado. Criando perfil inicial...`);
        
        user = await prisma.user.create({
            data: {
                auth0UserId,
                email,
                name,
                profilePictureUrl: picture,
                status: 'PENDING_ONBOARDING', // Status inicial para forçar o /perfil/completar
                role: 'INVESTOR' // Default
            }
        });

        return user;
    }
}

export { SyncAuth0UserUseCase };