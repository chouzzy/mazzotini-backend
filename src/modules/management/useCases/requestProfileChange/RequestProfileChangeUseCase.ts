import { prisma } from '../../../../prisma';


class RequestProfileChangeUseCase {
    async execute(userId: string, proposedData: Record<string, any>) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new Error("Usuário não encontrado.");

        // Substitui qualquer solicitação pendente anterior
        await prisma.userProfileChangeRequest.deleteMany({
            where: { userId, status: "PENDING" }
        });

        const request = await prisma.userProfileChangeRequest.create({
            data: {
                userId,
                proposedData,
                status: "PENDING",
            }
        });

        return request;
    }
}

export { RequestProfileChangeUseCase };
