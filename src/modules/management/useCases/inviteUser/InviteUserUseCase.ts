// /src/modules/management/useCases/inviteUser/InviteUserUseCase.ts
import { auth0ManagementService } from "../../../../services/auth0ManagementService";

interface IRequest {
    email: string;
    name: string;
    initialRole: string;
}

/**
 * @class InviteUserUseCase
 * @description Lógica de negócio para convidar um novo utilizador para a plataforma.
 */
class InviteUserUseCase {
    async execute({ email, name, initialRole }: IRequest): Promise<void> {
        // Passo 1: Cria o utilizador no Auth0.
        // O Auth0 tratará de enviar o e-mail de verificação, que serve como convite.
        const { newUser, ticketUrl } = await auth0ManagementService.createUserAndGenerateInvite(email, name);

        console.log(`[INVITE USER] Link de criação de senha para ${email}: ${ticketUrl}`);

        if (!newUser.user_id) {
            throw new Error("Falha ao criar o utilizador no Auth0. O ID do utilizador não foi retornado.");
        }

        // Passo 2: Atribui a role inicial ao novo utilizador.
        // O nosso sistema espera um array de roles.
        await auth0ManagementService.updateUserRoles(newUser.user_id, [initialRole]);
    }
}

export { InviteUserUseCase };