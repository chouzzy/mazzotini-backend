import { auth0ManagementService } from "../../../../services/auth0ManagementService";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// =================================================================
//  CONFIGURAÇÃO DE CACHE (Memória RAM)
// =================================================================
// Variáveis globais fora da classe para persistirem entre requisições
let cachedAuth0Users: any[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 Minutos de Cache

// Tipagem para o formato que enviaremos ao frontend
export type UserManagementInfo = {
    id?: string;
    auth0UserId: string;
    email: string;
    name: string; 
    picture: string; 
    profilePictureUrl?: string | null; 
    lastLogin?: string;
    roles: (string | undefined)[];
    status?: string;
};

/**
 * @class ListManagementUsersUseCase
 * @description Lógica de negócio para buscar e formatar a lista de utilizadores para gestão.
 * Agora inclui CACHE para evitar o erro "Global limit has been reached" do Auth0.
 */
class ListManagementUsersUseCase {
    async execute(): Promise<UserManagementInfo[]> {
        const now = Date.now();
        
        // 1. Verifica Cache do Auth0
        // Se não temos cache OU se o cache expirou, buscamos novamente.
        if (!cachedAuth0Users || (now - lastFetchTime > CACHE_TTL_MS)) {
            console.log("[ListManagementUsers] Cache do Auth0 expirado ou vazio. Buscando na API...");
            try {
                cachedAuth0Users = await auth0ManagementService.getUsersWithRoles();
                lastFetchTime = now;
                console.log(`[ListManagementUsers] Cache atualizado com ${cachedAuth0Users.length} utilizadores.`);
            } catch (error: any) {
                console.error("[ListManagementUsers] Erro ao buscar do Auth0:", error.message);
                
                // Fallback: Se o Auth0 der erro (ex: Rate Limit), tentamos usar o cache antigo se existir
                if (cachedAuth0Users) {
                    console.warn("[ListManagementUsers] Usando cache antigo devido a erro na API.");
                } else {
                    throw error; // Se não tem cache nem API, falha.
                }
            }
        } else {
            console.log("[ListManagementUsers] Servindo lista de usuários do CACHE.");
        }

        const usersFromAuth0 = cachedAuth0Users!;
        
        // 2. Extrai os IDs do Auth0 para buscar os nossos perfis locais
        const auth0UserIds = usersFromAuth0
            .map(u => u.user_id)
            .filter(id => id) as string[];

        // 3. Busca todos os perfis correspondentes no nosso banco de dados local
        // (O banco local é rápido e não tem rate limit externo, então buscamos sempre para ter status fresco)
        const localUsers = await prisma.user.findMany({
            where: {
                auth0UserId: { in: auth0UserIds }
            },
            select: {
                id: true,
                auth0UserId: true,
                name: true,
                profilePictureUrl: true,
                status: true,
            }
        });

        // 4. Cria um "mapa" para facilitar a consulta
        const localUserMap = new Map(localUsers.map(u => [u.auth0UserId, u]));

        // 5. Enriquece os dados do Auth0 com os dados do nosso banco
        const formattedUsers = usersFromAuth0.map(auth0User => {
            const localProfile = localUserMap.get(auth0User.user_id!);
            
            return {
                id: localProfile?.id,
                auth0UserId: auth0User.user_id || 'N/A',
                email: auth0User.email || 'N/A',
                // Fonte da verdade: usa o nome do nosso DB; se não existir, usa o do Auth0
                name: localProfile?.name || auth0User.name || 'N/A',
                picture: auth0User.picture || '',
                // Fonte da verdade: envia a foto do nosso DB
                profilePictureUrl: localProfile?.profilePictureUrl,
                lastLogin: auth0User.last_login ? String(auth0User.last_login) : undefined,
                roles: auth0User.roles || [],
                status: localProfile?.status,
            };
        });

        return formattedUsers;
    }
}

export { ListManagementUsersUseCase };