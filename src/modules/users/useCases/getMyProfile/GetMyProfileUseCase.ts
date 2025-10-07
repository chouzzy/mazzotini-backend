// /src/modules/users/useCases/getMyProfile/GetMyProfileUseCase.ts
import { PrismaClient, User } from "@prisma/client";

const prisma = new PrismaClient();

class GetMyProfileUseCase {
    async execute(auth0UserId: string): Promise<User | null> {
        console.log(`[PROFILE] A buscar perfil para o utilizador: ${auth0UserId}`);
        const user = await prisma.user.findUnique({
            where: { auth0UserId },
        });
        return user;
    }
}

export { GetMyProfileUseCase };
