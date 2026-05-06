import { prisma } from '../../../../prisma';




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
    associateSequence?: number | null;   // código do próprio usuário (se for ASSOCIATE)
    referredBySequence?: number | null;  // código do associado que indicou este usuário
    approvedAt?: string | null;
    createdAt?: string | null;
};

interface IListUsersRequest {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    status?: string;
    onlyPlaceholders?: boolean;
    associateSearch?: string; // filtra pelo nome do associado vinculado
    approvedFrom?: string;   // data ISO — aprovados a partir de
    approvedTo?: string;     // data ISO — aprovados até
}

class ListManagementUsersUseCase {
    async execute({ page = 1, limit = 10, search, role, status, onlyPlaceholders, associateSearch, approvedFrom, approvedTo }: IListUsersRequest) {
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
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }

        // Filtra pelo nome do associado: busca tanto na relação referredBy quanto
        // no campo de texto livre `indication` (usado em importações manuais)
        const andClauses: Prisma.UserWhereInput[] = [];

        if (associateSearch) {
            andClauses.push({
                OR: [
                    { referredBy: { name: { contains: associateSearch, mode: 'insensitive' } } },
                    { indication: { contains: associateSearch, mode: 'insensitive' } },
                ]
            });
        }

        // Filtra por intervalo de data de aprovação
        if (approvedFrom || approvedTo) {
            andClauses.push({
                approvedAt: {
                    ...(approvedFrom ? { gte: new Date(approvedFrom) } : {}),
                    ...(approvedTo   ? { lte: new Date(new Date(approvedTo).setHours(23, 59, 59, 999)) } : {}),
                }
            });
        }

        if (andClauses.length > 0) {
            where.AND = andClauses;
        }

        // 2. BUSCA E CONTAGEM EM PARALELO
        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take: limit,
                orderBy: { name: 'asc' },
                include: {
                    referredBy: { select: { name: true, associateSequence: true } },
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
                associateSequence: user.associateSequence ?? null,
                referredBySequence: user.referredBy?.associateSequence ?? null,
                approvedAt: user.approvedAt?.toISOString() || null,
                createdAt: user.createdAt?.toISOString() || null,
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