// /src/modules/management/useCases/updateUserRoles/UpdateUserRolesUseCase.ts

import { auth0ManagementService } from "../../../services/auth0ManagementService";


interface IRequest {
    auth0UserId: string;
    roles: string[];
}

/**
 * @class UpdateUserRolesUseCase
 * @description Lógica de negócio para atualizar as roles de um utilizador.
 */
class UpdateUserRolesUseCase {
    async execute({ auth0UserId, roles }: IRequest): Promise<void> {
        await auth0ManagementService.updateUserRoles(auth0UserId, roles);
    }
}

export { UpdateUserRolesUseCase };
