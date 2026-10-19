import { prisma } from '../../../../prisma';
import { User } from '@prisma/client';
import { AppError } from '../../../../errors/AppError';
import { auth0ManagementService } from '../../../../services/auth0ManagementService';

interface IRequest {
    auth0UserId: string;
    // Nome e foto enviados pelo frontend servem só de reserva. O e-mail não entra
    // aqui de propósito: ele é lido do Auth0, porque é com ele que se decide o merge.
    name?: string;
    picture?: string;
}

class SyncAuth0UserUseCase {
    async execute({ auth0UserId, name, picture }: IRequest): Promise<User> {

        // 1. Tenta encontrar pelo Auth0 ID (Usuário já logado antes)
        let user = await prisma.user.findUnique({
            where: { auth0UserId }
        });

        if (user) {
            // Já existe e já está vinculado corretamente.
            return user;
        }

        // 2. Primeiro login: e-mail e verificação vêm do próprio Auth0, nunca do corpo
        //    da requisição. Antes o e-mail vinha do corpo, e qualquer conta nova podia
        //    se vincular ao cadastro de outra pessoa só informando o e-mail dela.
        const identity = await auth0ManagementService.getUserIdentity(auth0UserId);

        if (!identity.email) {
            throw new AppError('A conta não tem e-mail cadastrado no Auth0.', 400);
        }

        const email = identity.email;
        const profilePictureUrl = identity.picture || picture || '';
        console.log(`[SYNC AUTH0] Sincronizando usuário: ${email} (${auth0UserId})`);

        // 3. Tenta encontrar pelo E-MAIL (Shadow User do Legal One ou outro login)
        const existingUser = await prisma.user.findFirst({
            where: { email }
        });

        if (existingUser) {
            // Só vincula com o e-mail verificado: é o que prova que quem está logando
            // é dono do e-mail do cadastro (e não alguém que se cadastrou com ele).
            if (!identity.emailVerified) {
                console.warn(`[SYNC AUTH0] Merge recusado para ${email}: e-mail ainda não verificado.`);
                throw new AppError('Confirme seu e-mail para acessar sua conta.', 403, 'EMAIL_NOT_VERIFIED');
            }

            const origin = existingUser.auth0UserId.startsWith('legalone|import|') ? 'Usuário Sombra' : 'Cadastro existente';
            console.log(`[SYNC AUTH0] ${origin} encontrado para ${email}. Realizando MERGE de contas...`);
            console.log(`[SYNC AUTH0] Trocando ID ${existingUser.auth0UserId} -> ${auth0UserId}`);

            // ATUALIZA O USUÁRIO EXISTENTE
            // Substitui o ID anterior (legalone|... ou outro login) pelo ID atual do Auth0
            user = await prisma.user.update({
                where: { id: existingUser.id },
                data: {
                    auth0UserId: auth0UserId,
                    profilePictureUrl, // Atualiza a foto que veio do Auth0
                    // Mantém os outros dados (endereço, CPF) que vieram do Legal One
                }
            });

            return user;
        }

        // 4. Se não achou nem por ID nem por Email, cria um novo do zero
        console.log(`[SYNC AUTH0] Novo usuário detectado. Criando perfil inicial...`);

        user = await prisma.user.create({
            data: {
                auth0UserId,
                email,
                name: identity.name || name || email,
                profilePictureUrl,
                status: 'PENDING_ONBOARDING', // Status inicial para forçar o /perfil/completar
                role: 'INVESTOR' // Default
            }
        });

        return user;
    }
}

export { SyncAuth0UserUseCase };
