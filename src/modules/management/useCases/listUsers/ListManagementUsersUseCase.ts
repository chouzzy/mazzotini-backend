// /src/modules/management/useCases/listUsers/ListManagementUsersUseCase.ts

import { auth0ManagementService } from "../../../../services/auth0ManagementService";


// Tipagem para o formato que enviaremos ao frontend
export type UserManagementInfo = {
    auth0UserId: string;
    email: string;
    name: string;
    picture: string;
    lastLogin?: string;
    roles: (string | undefined)[];
};

/**
 * @class ListManagementUsersUseCase
 * @description Lógica de negócio para buscar e formatar a lista de utilizadores para gestão.
 */
class ListManagementUsersUseCase {
    async execute(): Promise<UserManagementInfo[]> {
        const usersFromAuth0 = await auth0ManagementService.getUsersWithRoles();

        // Mapeia os dados brutos do Auth0 para o formato limpo que o nosso frontend precisa
        const formattedUsers = usersFromAuth0.map(user => ({
            auth0UserId: user.user_id || 'N/A',
            email: user.email || 'N/A',
            name: user.name || 'N/A',
            picture: user.picture || '',
            lastLogin: user.last_login ? user.last_login.toString() : undefined,
            roles: user.roles,
        }));

        return formattedUsers;
    }
}

export { ListManagementUsersUseCase };
