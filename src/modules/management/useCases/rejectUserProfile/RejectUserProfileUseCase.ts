// /src/modules/management/useCases/rejectUserProfile/RejectUserProfileUseCase.ts
import { PrismaClient } from "@prisma/client";
// Importa os dois serviços que precisamos para a exclusão
import { auth0ManagementService } from "../../../../services/auth0ManagementService";

const prisma = new PrismaClient();

class RejectUserProfileUseCase {

    /**
     * ATUALIZADO: Esta função agora exclui permanentemente o utilizador
     * do Auth0 e do nosso banco de dados Prisma.
     * @param prismaUserId O ID do utilizador no *nosso* banco (Prisma).
     */
    async execute(prismaUserId: string): Promise<void> {
        console.log(`[ADMIN] Rejeitando (excluindo) perfil do utilizador ID: ${prismaUserId}`);

        // 1. Busca os dados completos do utilizador no nosso DB
        const user = await prisma.user.findUniqueOrThrow({
            where: { id: prismaUserId },
            select: { 
                id: true, 
                auth0UserId: true, 
                name: true, 
                profilePictureUrl: true, 
                personalDocumentUrls: true 
            }
        });

        if (!user.auth0UserId) {
            throw new Error(`Utilizador ${prismaUserId} não possui um auth0UserId associado.`);
        }

        // 2. Exclui o utilizador do Auth0 PRIMEIRO
        // Se isto falhar, a transação pára e não apagamos o nosso registo.
        await auth0ManagementService.deleteUser(user.auth0UserId);

        // 3. (Opcional, mas recomendado) Exclui os arquivos do S3/Spaces
        // TODO: Implementar a lógica de exclusão no s3Service se quisermos
        // if (user.profilePictureUrl) {
        //     await s3Service.deleteFile(user.profilePictureUrl);
        // }
        // for (const docUrl of user.personalDocumentUrls) {
        //     await s3Service.deleteFile(docUrl);
        // }

        // 4. Exclui o utilizador do nosso banco de dados (Prisma)
        // (Nota: O Prisma deve estar configurado para apagar 'Investments' em cascata,
        // ou precisaremos de apagar manualmente os 'Investments' primeiro.)
        await prisma.user.delete({
            where: { id: prismaUserId }
        });

        console.log(`[ADMIN] Perfil de ${user.name} (ID: ${prismaUserId}) foi permanentemente rejeitado e excluído.`);
        
        // TODO: Enviar um e-mail de "Seu perfil foi rejeitado" (opcional).
    }
}

export { RejectUserProfileUseCase };