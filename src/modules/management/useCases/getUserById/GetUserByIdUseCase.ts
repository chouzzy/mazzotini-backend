import { PrismaClient, User } from "@prisma/client";

const prisma = new PrismaClient();

class GetUserByIdUseCase {
    async execute(userId: string): Promise<User> {
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            throw new Error("Usuário não encontrado.");
        }

        return user;
    }
}

export { GetUserByIdUseCase };