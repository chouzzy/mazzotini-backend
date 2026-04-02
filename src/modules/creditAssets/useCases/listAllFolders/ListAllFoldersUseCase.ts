import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface IListFoldersRequest {
    auth0UserId: string;
    roles: string[];
    page?: number;
    limit?: number;
    search?: string;
}

class ListAllFoldersUseCase {
    async execute({ auth0UserId, roles, page = 1, limit = 10, search }: IListFoldersRequest) {
        console.log(`[FOLDERS] Listando pastas paginadas: ${page} (Busca: ${search || 'Nenhuma'})`);

        const isAdmin = roles.includes('ADMIN') || roles.includes('OPERATOR');
        const skip = (page - 1) * limit;
        
        let currentUserId = "";
        if (!isAdmin) {
            const user = await prisma.user.findUnique({ where: { auth0UserId }, select: { id: true } });
            if (!user) throw new Error("Usuário não encontrado.");
            currentUserId = user.id;
        }

        // 1. CONSTRUÇÃO DO FILTRO (WHERE)
        // O filtro de busca olha para o código da pasta, descrição OU dados dos ativos dentro dela
        const where: Prisma.ProcessFolderWhereInput = {};

        // Filtro de Privacidade (Se for investidor, só vê pastas que tenham seus ativos)
        if (!isAdmin) {
            where.assets = { some: { investors: { some: { userId: currentUserId } } } };
        }

        // Filtro de Busca
        if (search) {
            where.OR = [
                { folderCode: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { assets: { some: { 
                    OR: [
                        { processNumber: { contains: search, mode: 'insensitive' } },
                        { nickname: { contains: search, mode: 'insensitive' } },
                        { originalCreditor: { contains: search, mode: 'insensitive' } }
                    ]
                } } }
            ];
        }

        // 2. BUSCA PAGINADA E CONTAGEM
        const [folders, total] = await Promise.all([
            prisma.processFolder.findMany({
                where,
                skip,
                take: limit,
                include: {
                    assets: {
                        include: {
                            investors: { include: { user: { select: { id: true, name: true } } } }
                        },
                        orderBy: { acquisitionDate: 'desc' }
                    }
                },
                orderBy: { updatedAt: 'desc' }
            }),
            prisma.processFolder.count({ where })
        ]);

        // 3. FORMATAÇÃO E FILTRO DE VISIBILIDADE DOS ATIVOS
        const items = folders.map(folder => {
            const visibleAssets = isAdmin 
                ? folder.assets 
                : folder.assets.filter(asset => asset.investors.some(inv => inv.user?.id === currentUserId));

            const totalAcquisition = visibleAssets.reduce((sum, a) => sum + a.acquisitionValue, 0);
            const totalCurrent = visibleAssets.reduce((sum, a) => sum + a.currentValue, 0);

            const assetsFormatted = visibleAssets.map(asset => ({
                id: asset.id,
                legalOneId: asset.legalOneId,
                processNumber: asset.processNumber,
                nickname: asset.nickname,
                originalCreditor: asset.originalCreditor,
                currentValue: asset.currentValue,
                status: asset.status,
                acquisitionDate: asset.acquisitionDate,
                mainInvestorName: asset.investors[0]?.user?.name || 'N/A',
                investedValue: asset.acquisitionValue,
                legalOneType: asset.legalOneType
            }));

            return {
                id: folder.id,
                folderCode: folder.folderCode,
                description: folder.description,
                totalAcquisition,
                totalCurrent,
                assets: assetsFormatted
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

export { ListAllFoldersUseCase };