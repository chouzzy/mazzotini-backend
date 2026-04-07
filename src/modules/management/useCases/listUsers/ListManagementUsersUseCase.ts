import { PrismaClient, Prisma, Role, UserStatus } from "@prisma/client";

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
    associateName?: string | null;
};

interface IListUsersRequest {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    status?: string;
    onlyPlaceholders?: boolean; // <-- NOVO PARÂMETRO
}

class ListManagementUsersUseCase {
    async execute({ page = 1, limit = 10, search, role, status, onlyPlaceholders }: IListUsersRequest) {
        const skip = (page - 1) * limit;

        // 1. CONSTRUÇÃO DO FILTRO (WHERE)
        const where: Prisma.UserWhereInput = {};

        if (status && status !== 'ALL') {
            where.status = status as UserStatus;
        }

        if (role && role !== 'ALL') {
            where.role = role as Role;
        }

        // Se o filtro de placeholders estiver ativo, forçamos a busca pelo domínio
        if (onlyPlaceholders) {
            where.email = { contains: '@mazzotini.placeholder', mode: 'insensitive' };
        }

        if (search) {
            // Se já houver um filtro de placeholder, o search vira um AND implícito
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
                include: {
                    referredBy: { select: { name: true } },
                },
            }),
            prisma.user.count({ where })
        ]);

        // 3. MAPEAMENTO
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
                lastLogin: user.updatedAt?.toISOString() || '', 
                roles: roles, 
                status: user.status || 'ACTIVE',
                associateName: user.referredBy?.name || user.indication || null,
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