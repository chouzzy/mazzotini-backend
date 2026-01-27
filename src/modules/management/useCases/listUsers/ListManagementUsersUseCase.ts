import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Tipagem para o formato que enviaremos ao frontend
export type UserManagementInfo = {
    id: string;
    auth0UserId: string;
    email: string;
    name: string; 
    picture: string; 
    profilePictureUrl?: string | null; 
    lastLogin?: string;
    roles: string[];
    status?: string;
};

/**
 * @class ListManagementUsersUseCase
 * @description Busca utilizadores do banco local.
 * Inclui gerador de avatar (UI Avatars) para quem não tem foto.
 */
class ListManagementUsersUseCase {
    async execute(): Promise<UserManagementInfo[]> {
        console.log("[ListManagementUsers] Buscando utilizadores e roles do banco local...");

        const localUsers = await prisma.user.findMany({
            orderBy: { name: 'asc' },
            select: {
                id: true,
                auth0UserId: true,
                email: true,
                name: true,
                // pictureUrl: true, // Removido pois nem sempre existe no schema
                profilePictureUrl: true, 
                status: true,
                role: true, 
                createdAt: true,
                updatedAt: true
            }
        });

        const formattedUsers: UserManagementInfo[] = localUsers.map(user => {
            const roles = user.role ? [user.role] : [];
            const displayName = user.name || user.email;

            // =================================================================
            // SOLUÇÃO: UI Avatars (API Gratuita)
            // Gera um avatar com as iniciais se não houver foto
            // =================================================================
            const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random&color=fff&size=128`;

            return {
                id: user.id,
                auth0UserId: user.auth0UserId,
                email: user.email,
                name: displayName,
                
                // Usa a foto do perfil se existir, senão usa o gerador de avatar
                picture: user.profilePictureUrl || fallbackAvatar, 
                
                profilePictureUrl: user.profilePictureUrl,
                lastLogin: user.updatedAt.toISOString(), 
                roles: roles, 
                status: user.status,
            };
        });

        console.log(`[ListManagementUsers] ${formattedUsers.length} utilizadores retornados.`);
        return formattedUsers;
    }
}

export { ListManagementUsersUseCase };