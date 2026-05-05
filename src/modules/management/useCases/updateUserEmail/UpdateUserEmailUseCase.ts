import { prisma } from '../../../../prisma';
import { auth0ManagementService } from "../../../../services/auth0ManagementService";
import { AppError } from "../../../../errors/AppError";


class UpdateUserEmailUseCase {
    async execute(auth0UserId: string, newEmail: string): Promise<void> {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newEmail)) {
            throw new AppError("E-mail inválido.", 400);
        }

        const existing = await prisma.user.findFirst({ where: { email: newEmail } });
        if (existing && existing.auth0UserId !== auth0UserId) {
            throw new AppError("Este e-mail já está em uso por outro usuário.", 409);
        }

        // 1. Atualiza no Auth0
        await auth0ManagementService.updateUserEmail(auth0UserId, newEmail);

        // 2. Atualiza no banco local
        await prisma.user.update({
            where: { auth0UserId },
            data: { email: newEmail },
        });

        console.log(`[UPDATE EMAIL] E-mail de ${auth0UserId} atualizado para ${newEmail}.`);
    }
}

export { UpdateUserEmailUseCase };
