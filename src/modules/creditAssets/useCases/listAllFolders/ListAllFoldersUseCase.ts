import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

class ListAllFoldersUseCase {
    async execute(auth0UserId: string, roles: string[]) {
        console.log(`[FOLDERS] Listando pastas para o utilizador: ${auth0UserId} [${roles.join(',')}]`);

        const isAdmin = roles.includes('ADMIN') || roles.includes('OPERATOR');
        let prismaWhere: any = {};
        let currentUserId = "";

        // SE NÃO FOR ADMIN: Descobre o ID local para filtrar
        if (!isAdmin) {
            const user = await prisma.user.findUnique({
                where: { auth0UserId },
                select: { id: true }
            });

            if (!user) throw new Error("Usuário não encontrado.");
            currentUserId = user.id;

            // Filtro Mágico: Traz apenas pastas que contenham ativos onde este usuário é investidor
            prismaWhere = {
                assets: {
                    some: {
                        investors: {
                            some: { userId: currentUserId }
                        }
                    }
                }
            };
        } else {
            // Se for Admin, traz pastas que tenham pelo menos um ativo
            prismaWhere = { assets: { some: {} } };
        }

        const folders = await prisma.processFolder.findMany({
            where: prismaWhere,
            include: {
                assets: {
                    include: {
                        investors: {
                            include: {
                                user: { select: { id: true, name: true } } // Incluímos o ID para filtrar no JS
                            }
                        }
                    },
                    orderBy: { acquisitionDate: 'desc' }
                }
            },
            orderBy: { updatedAt: 'desc' }
        });

        // Formata e FILTRA OS ATIVOS DENTRO DA PASTA
        // (Isso impede que o investidor veja outros processos da mesma pasta que não são dele)
        const formattedFolders = folders.map(folder => {

            // Se for Admin, vê todos os assets da pasta.
            // Se for Investidor, vê apenas os assets onde ele está na lista de investidores.
            const visibleAssets = isAdmin
                ? folder.assets
                : folder.assets.filter(asset => asset.investors.some(inv => inv.user?.id === currentUserId));

            // Recalcula totais baseado apenas no que é visível
            const totalAcquisition = visibleAssets.reduce((sum, a) => sum + a.acquisitionValue, 0);
            const totalCurrent = visibleAssets.reduce((sum, a) => sum + a.currentValue, 0);

            const assetsFormatted = visibleAssets.map(asset => {
                const mainInvestor = asset.investors[0]?.user?.name || 'N/A';

                // Calcula o valor investido por ESSE usuário (se não for admin)
                let userInvestedValue = asset.acquisitionValue;
                if (!isAdmin) {
                    const myInvestment = asset.investors.find(inv => inv.user?.id === currentUserId);
                    if (myInvestment) {
                        userInvestedValue = asset.acquisitionValue * (myInvestment.investorShare / 100);
                    }
                }

                return {
                    id: asset.id,
                    processNumber: asset.processNumber,
                    nickname: asset.nickname,
                    originalCreditor: asset.originalCreditor,
                    currentValue: asset.currentValue,
                    status: asset.status,
                    acquisitionDate: asset.acquisitionDate,
                    mainInvestorName: mainInvestor,
                    investedValue: userInvestedValue,
                    updateIndexType: asset.updateIndexType,
                    legalOneType: asset.legalOneType
                };
            });

            return {
                id: folder.id,
                folderCode: folder.folderCode,
                description: folder.description,
                totalAcquisition,
                totalCurrent,
                assets: assetsFormatted
            };
        });

        // Remove pastas que ficaram vazias após o filtro de segurança (edge case)
        return formattedFolders.filter(f => f.assets.length > 0);
    }
}

export { ListAllFoldersUseCase };