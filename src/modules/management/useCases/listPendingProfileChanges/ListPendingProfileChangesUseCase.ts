import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

class ListPendingProfileChangesUseCase {
    async execute() {
        return prisma.userProfileChangeRequest.findMany({
            where: { status: "PENDING" },
            orderBy: { createdAt: "asc" },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        profilePictureUrl: true,
                        cpfOrCnpj: true,
                        cellPhone: true,
                        residentialCity: true,
                        residentialState: true,
                    }
                }
            }
        });
    }
}

export { ListPendingProfileChangesUseCase };
