import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

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

interface IListUsersRequest {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    status?: string;
}

class ListManagementUsersUseCase {
    async execute({ page = 1, limit = 10, search, role, status }: IListUsersRequest) {
        const skip = (page - 1) * limit;

        // 1. CONSTRUÇÃO DO FILTRO (WHERE)
        const where: Prisma.UserWhereInput = {};

        if (status && status !== 'ALL') {
            where.status = status;
        }

        if (role && role !== 'ALL') {
            where.role = role as Prisma.EnumRoleFilter;
        }

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }

        // 2. BUSCA E CONTAGEM EM PARALELO
        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take: limit,
                orderBy: { name: 'asc' },
            }),
            prisma.user.count({ where })
        ]);

        // 3. MAPEAMENTO COM FALLBACK DE AVATAR (Sua lógica original)
        const items: UserManagementInfo[] = users.map(user => {
            const roles = user.role ? [user.role] : [];
            const displayName = user.name || user.email;
            const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random&color=fff&size=128`;

            return {
                id: user.id,
                auth0UserId: user.auth0UserId,
                email: user.email,
                name: displayName,
                picture: user.profilePictureUrl || fallbackAvatar, 
                profilePictureUrl: user.profilePictureUrl,
                lastLogin: user.updatedAt.toISOString(), 
                roles: roles, 
                status: user.status || 'ACTIVE',
            };
        });

        return {
            items,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
    }
}

export { ListManagementUsersUseCase };