import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ROLES = {
    ADMIN: process.env.ROLE_ADMIN || 'ADMIN',
    OPERATOR: process.env.ROLE_OPERATOR || 'OPERATOR',
    INVESTOR: process.env.ROLE_INVESTOR || 'INVESTOR',
    ASSOCIATE: process.env.ROLE_ASSOCIATE || 'ASSOCIATE',
};

export type AssetSummary = {
    id: string;
    processNumber: string;
    nickname?: string | null;
    originalCreditor: string;
    currentValue: number;
    status: string;
    acquisitionDate: Date;
    mainInvestorName: string | null;
    investorId: string | null;
    associateId: string | null;
    investorShare: number;
    investedValue: number;
    updateIndexType: string | null;
};

interface IListAssetsRequest {
    auth0UserId: string;
    roles: string[];
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
}

const assetWithInvestorPayload = {
    include: { 
        investors: { 
            include: { 
                user: { select: { name: true, id: true } }
            } 
        } 
    }
};

type AssetWithInvestor = Prisma.CreditAssetGetPayload<typeof assetWithInvestorPayload>;

class ListAllAssetsUseCase {
    async execute({ auth0UserId, roles, page = 1, limit = 10, search, status }: IListAssetsRequest) {
        const primaryRole = roles[0];
        const skip = (page - 1) * limit;

        const user = await prisma.user.findUnique({
            where: { auth0UserId },
            select: { id: true }
        });

        if (!user) return { items: [], meta: { total: 0, page, limit, totalPages: 0 } };

        // 1. CONSTRUÇÃO DO FILTRO (WHERE) BASEADO NA ROLE E BUSCA
        const where: Prisma.CreditAssetWhereInput = {};

        // Filtro de Role
        if (primaryRole === ROLES.INVESTOR) {
            where.investors = { some: { userId: user.id } };
        } else if (primaryRole === ROLES.ASSOCIATE) {
            where.OR = [
                { associateId: user.id },
                { investors: { some: { associateId: user.id } } }
            ];
        }

        // Filtro de Status
        if (status) {
            where.status = status;
        }

        // Filtro de Busca (Search)
        if (search) {
            where.OR = [
                ...(where.OR || []),
                { processNumber: { contains: search, mode: 'insensitive' } },
                { originalCreditor: { contains: search, mode: 'insensitive' } },
                { nickname: { contains: search, mode: 'insensitive' } },
            ];
        }

        // 2. BUSCA PAGINADA E CONTAGEM EM PARALELO
        const [assets, total] = await Promise.all([
            prisma.creditAsset.findMany({
                where,
                skip,
                take: limit,
                orderBy: { acquisitionDate: 'desc' },
                ...assetWithInvestorPayload
            }),
            prisma.creditAsset.count({ where })
        ]);

        // 3. MAPEAMENTO DEFENSIVO (Seu código original)
        const items = assets.map(asset => {
            const mainInvestment = asset.investors?.[0]; 
            return {
                id: asset.id,
                processNumber: asset.processNumber,
                nickname: asset.nickname,
                originalCreditor: asset.originalCreditor,
                currentValue: asset.currentValue,
                status: asset.status,
                acquisitionDate: asset.acquisitionDate,
                mainInvestorName: mainInvestment?.user?.name || 'N/A', 
                investorId: mainInvestment?.user?.id || null, 
                associateId: asset.associateId || null,
                investorShare: 0,
                investedValue: asset.acquisitionValue, 
                updateIndexType: asset.updateIndexType || null,
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

export { ListAllAssetsUseCase };