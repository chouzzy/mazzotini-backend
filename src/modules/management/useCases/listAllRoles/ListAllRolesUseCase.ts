// /src/modules/management/useCases/listAllRoles/ListAllRolesUseCase.ts


import { GetOrganizationMemberRoles200ResponseOneOfInner } from "auth0";
import { auth0ManagementService } from "../../../../services/auth0ManagementService";

/**
 * @class ListAllRolesUseCase
 * @description Lógica de negócio para buscar e formatar a lista de roles disponíveis.
 */
class ListAllRolesUseCase {
    async execute(): Promise<GetOrganizationMemberRoles200ResponseOneOfInner[]> {
        return await auth0ManagementService.getAllRoles();
    }
}

export { ListAllRolesUseCase };
