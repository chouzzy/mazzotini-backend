import { PrismaClient } from "@prisma/client";
import { AdminUpdateUserUseCase } from "../adminUpdateUser/AdminUpdateUserUseCase";

const prisma = new PrismaClient();

class ReviewProfileChangeUseCase {
    async approve(requestId: string) {
        const changeRequest = await prisma.userProfileChangeRequest.findUnique({
            where: { id: requestId }
        });
        if (!changeRequest) throw new Error("Solicitação não encontrada.");
        if (changeRequest.status !== "PENDING") throw new Error("Solicitação já foi processada.");

        // Aplica os dados propostos no perfil real
        const adminUpdate = new AdminUpdateUserUseCase();
        const updatedUser = await adminUpdate.execute(changeRequest.userId, changeRequest.proposedData as Record<string, any>);

        await prisma.userProfileChangeRequest.update({
            where: { id: requestId },
            data: { status: "APPROVED" }
        });

        return updatedUser;
    }

    async reject(requestId: string, reason?: string) {
        const changeRequest = await prisma.userProfileChangeRequest.findUnique({
            where: { id: requestId }
        });
        if (!changeRequest) throw new Error("Solicitação não encontrada.");
        if (changeRequest.status !== "PENDING") throw new Error("Solicitação já foi processada.");

        await prisma.userProfileChangeRequest.update({
            where: { id: requestId },
            data: { status: "REJECTED", rejectionReason: reason || null }
        });
    }
}

export { ReviewProfileChangeUseCase };
