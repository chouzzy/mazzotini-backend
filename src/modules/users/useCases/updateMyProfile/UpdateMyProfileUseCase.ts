// /src/modules/users/useCases/updateMyProfile/UpdateMyProfileUseCase.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// A interface agora reflete todos os novos campos do schema.prisma
interface IRequest {
    auth0UserId: string;
    data: {
        name?: string;
        cpfOrCnpj?: string;
        phone?: string;
        cellPhone?: string;
        rg?: string;
        birthDate?: Date;
        profession?: string;
        contactPreference?: string;
        infoEmail?: string;
        residentialCep?: string;
        residentialStreet?: string;
        residentialNumber?: string;
        residentialComplement?: string;
        residentialNeighborhood?: string;
        residentialCity?: string;
        residentialState?: string;
        commercialCep?: string;
        commercialStreet?: string;
        commercialNumber?: string;
        commercialComplement?: string;
        commercialNeighborhood?: string;
        commercialCity?: string;
        commercialState?: string;
        nationality?: string;
        maritalStatus?: string;
    };
}

class UpdateMyProfileUseCase {
    async execute({ auth0UserId, data }: IRequest): Promise<void> {
        console.log(`[PROFILE] A atualizar perfil para o utilizador: ${auth0UserId}`);

        // O 'address' antigo é removido para não ser salvo,
        // já que agora usamos os campos de endereço estruturados.
        const { address, ...validData } = data as any;

        await prisma.user.update({
            where: { auth0UserId },
            data: {
                ...validData,
                profileCompleted: true, // Garante que o perfil seja marcado como completo
            },
        });

        console.log(`[PROFILE] Perfil de ${auth0UserId} atualizado com sucesso.`);
    }
}

export { UpdateMyProfileUseCase };
