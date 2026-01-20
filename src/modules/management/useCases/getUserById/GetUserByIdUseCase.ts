import { PrismaClient, User } from "@prisma/client";

const prisma = new PrismaClient();

class GetUserByIdUseCase {
    async execute(userId: string): Promise<User> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            // NOVO: Incluir investimentos e dados do ativo para exibição
            include: {
                investments: {
                    include: {
                        asset: {
                            select: {
                                id: true,
                                processNumber: true,
                                nickname: true,
                                status: true
                            }
                        }
                    }
                }
            }
        });

        if (!user) {
            throw new Error("Usuário não encontrado.");
        }

        return user;
    }
}

export { GetUserByIdUseCase };