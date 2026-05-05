// /src/modules/management/useCases/updateUserRoles/UpdateUserRolesUseCase.ts


import { prisma } from '../../../../prisma';
import { auth0ManagementService } from "../../../../services/auth0ManagementService";



const VALID_ROLES: Role[] = ['ADMIN', 'OPERATOR', 'INVESTOR', 'ASSOCIATE'];

interface IRequest {
    auth0UserId: string;
    roles: string[];
}

/**
 * @class UpdateUserRolesUseCase
 * @description Lógica de negócio para atualizar as roles de um utilizador.
 * Atualiza tanto o Auth0 quanto o banco de dados local (Prisma).
 */
class UpdateUserRolesUseCase {
    async execute({ auth0UserId, roles }: IRequest): Promise<void> {
        // 1. Atualiza no Auth0
        await auth0ManagementService.updateUserRoles(auth0UserId, roles);

        // 2. Atualiza no banco de dados local para manter consistência
        const newRole = roles[0] as Role;
        if (newRole && VALID_ROLES.includes(newRole)) {
            await prisma.user.update({
                where: { auth0UserId },
                data: { role: newRole },
            });
            console.log(`[UPDATE ROLES] Role do usuário ${auth0UserId} atualizada para ${newRole} no banco.`);
        }
    }
}

export { UpdateUserRolesUseCase };
