// Caminho: src/modules/creditAssets/useCases/listAllAssets/ListAllAssetsUseCase.ts

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
    legalOneType?: string | null;
    parentProcessNumber?: string | null;
};

interface IListAssetsRequest {
    auth0UserId: string;
    roles: string[];
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    type?: string; // <-- NOVO FILTRO
}

const assetWithInvestorPayload = {
    include: { 
        investors: { 
            include: { 
                user: { select: { name: true, id: true } }
            } 
        },
        folder: {
            include: {
                assets: {
                    where: { legalOneType: 'Lawsuit' },
                    select: { processNumber: true }
                }
            }
        }
    }
};

class ListAllAssetsUseCase {
    async execute({ auth0UserId, roles, page = 1, limit = 10, search, status, type }: IListAssetsRequest) {
        const primaryRole = roles[0];
        const skip = (page - 1) * limit;

        const user = await prisma.user.findUnique({
            where: { auth0UserId },
            select: { id: true }
        });

        if (!user) return { items: [], meta: { total: 0, page, limit, totalPages: 0 } };

        const where: Prisma.CreditAssetWhereInput = {};

        if (primaryRole === ROLES.INVESTOR || primaryRole === ROLES.ASSOCIATE) {
            where.investors = { some: { userId: user.id } };
        }

        if (status) {
            where.status = status;
        }

        // --- NOVO: Lógica de Filtro por Tipo ---
        if (type && type !== 'ALL') {
            if (type === 'LAWSUIT') {
                where.AND = [
                    ...(where.AND as any[] || []),
                    { OR: [{ legalOneType: 'Lawsuit' }, { legalOneType: null }] }
                ];
            } else if (type === 'APPEAL') {
                where.legalOneType = 'Appeal';
            } else if (type === 'INCIDENT') {
                where.legalOneType = 'ProceduralIssue';
            }
        }

        if (search) {
            const searchFilter = { contains: search, mode: 'insensitive' as Prisma.QueryMode };
            where.OR = [
                ...(where.OR as any[] || []),
                { processNumber: searchFilter },
                { originalCreditor: searchFilter },
                { nickname: searchFilter },
            ];
        }

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

        const items = assets.map(asset => {
            const mainInvestment = asset.investors?.[0]; 
            const parentProcessNumber = (asset.legalOneType === 'Appeal' || asset.legalOneType === 'ProceduralIssue') && asset.folder?.assets?.length
                ? asset.folder.assets[0].processNumber
                : null;

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
                legalOneType: asset.legalOneType || 'Lawsuit',
                parentProcessNumber: parentProcessNumber
            };
        });

        return { items, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
    }
}

export { ListAllAssetsUseCase };