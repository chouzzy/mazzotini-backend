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
            const updateData: any = { role: newRole };

            // Auto-assign sequential code when promoting to ASSOCIATE
            if (newRole === 'ASSOCIATE') {
                const user = await prisma.user.findUnique({
                    where: { auth0UserId },
                    select: { associateSequence: true },
                });
                if (!user?.associateSequence) {
                    const max = await prisma.user.aggregate({
                        _max: { associateSequence: true },
                        where: { associateSequence: { not: null } },
                    });
                    updateData.associateSequence = (max._max.associateSequence ?? 0) + 1;
                    console.log(`[UPDATE ROLES] Código ${updateData.associateSequence} atribuído ao novo associado.`);
                }
            }

            await prisma.user.update({
                where: { auth0UserId },
                data: updateData,
            });
            console.log(`[UPDATE ROLES] Role do usuário ${auth0UserId} atualizada para ${newRole} no banco.`);
        }
    }
}

export { UpdateUserRolesUseCase };
