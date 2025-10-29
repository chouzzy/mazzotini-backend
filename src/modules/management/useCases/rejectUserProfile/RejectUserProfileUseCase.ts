// /src/modules/management/useCases/rejectUserProfile/RejectUserProfileUseCase.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

class RejectUserProfileUseCase {
    async execute(userId: string): Promise<void> {
        console.log(`[ADMIN] Rejeitando perfil do utilizador ID: ${userId}`);
        
        await prisma.user.update({
            where: { id: userId },
            data: {
                status: "REJECTED",
            }
        });
        
        // TODO: Enviar um e-mail de "Seu perfil foi rejeitado" com o motivo.
        console.log(`[ADMIN] Perfil ${userId} rejeitado com sucesso.`);
    }
}

export { RejectUserProfileUseCase };
