import { prisma } from '../../../../prisma';
import { notifyAllAdmins } from '../../../../services/notificationService';


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

        await notifyAllAdmins({
            title: 'Solicitação de alteração de perfil',
            message: `${user.name} solicitou alterações em seu perfil cadastral. Acesse a gestão de usuários para revisar e aprovar.`,
            type: 'info',
            notificationType: 'PROFILE_CHANGE_REQUESTED',
            relatedEntityId: userId,
            relatedEntityType: 'User',
            relatedEntityName: user.name,
            link: `/gestao/usuarios/${userId}`,
        });

        return request;
    }
}

export { RequestProfileChangeUseCase };
