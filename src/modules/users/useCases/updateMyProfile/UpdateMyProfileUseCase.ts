// /src/modules/users/useCases/updateMyProfile/UpdateMyProfileUseCase.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface IRequest {
    auth0UserId: string;
    data: {
        name?: string;
        cpfOrCnpj?: string;
        phone?: string;
        cellPhone?: string;
        address?: string;
        nationality?: string;
        maritalStatus?: string;
    };
}

class UpdateMyProfileUseCase {
    async execute({ auth0UserId, data }: IRequest): Promise<void> {
        console.log(`[PROFILE] A atualizar perfil para o utilizador: ${auth0UserId}`);

        await prisma.user.update({
            where: { auth0UserId },
            data: {
                ...data,
                profileCompleted: true, // Marca o perfil como completo!
            },
        });

        console.log(`[PROFILE] Perfil de ${auth0UserId} atualizado com sucesso.`);
    }
}

export { UpdateMyProfileUseCase };
