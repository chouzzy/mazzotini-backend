import { prisma } from '../../../../prisma';
import { AppError } from '../../../../errors/AppError';
import { VISIBLE_UPDATES_FILTER } from '../../../../utils/updateDescriptionParser';
import { UNSYNCED_STATUSES } from '../../../creditAssets/useCases/listAllAssets/ListAllAssetsUseCase';

const OBJECT_ID = /^[a-f0-9]{24}$/i;

class GetAssociateClientProcessesUseCase {
    async execute(auth0UserId: string, clientId: string) {
        const associate = await prisma.user.findUnique({
            where: { auth0UserId },
            select: { id: true },
        });
        if (!associate) throw new AppError('Associado não encontrado.', 404);

        // Só os clientes que o associado acompanha em algum processo
        if (!OBJECT_ID.test(clientId)) throw new AppError('Cliente não encontrado.', 404);
        const linked = await prisma.investment.count({
            where: { associateId: associate.id, userId: clientId },
        });
        if (!linked) throw new AppError('Cliente não encontrado.', 404);

        const client = await prisma.user.findUnique({
            where: { id: clientId },
            select: { id: true, name: true, email: true, profilePictureUrl: true },
        });
        if (!client) throw new AppError('Cliente não encontrado.', 404);

        const investments = await prisma.investment.findMany({
            where: {
                associateId: associate.id,
                userId: clientId,
                // Como no resto do portal do associado: processo ainda sem os dados do Legal One não aparece
                asset: { status: { notIn: UNSYNCED_STATUSES } },
            },
            select: {
                id: true,
                investorShare: true,
                acquisitionDate: true,
                asset: {
                    select: {
                        id: true,
                        legalOneId: true,
                        processNumber: true,
                        nickname: true,
                        otherParty: true,
                        originalCreditor: true,
                        currentValue: true,
                        acquisitionValue: true,
                        status: true,
                        updates: {
                            where: VISIBLE_UPDATES_FILTER,
                            orderBy: { date: 'desc' },
                            take: 1,
                        },
                    },
                },
            },
        });

        const displayName = client.name || client.email;
        const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random&color=fff&size=128`;

        return {
            client: {
                id: client.id,
                name: displayName,
                email: client.email,
                picture: client.profilePictureUrl || fallback,
            },
            processes: investments.map(inv => ({
                investmentId: inv.id,
                investorShare: inv.investorShare,
                acquisitionDate: inv.acquisitionDate,
                legalOneId: inv.asset.legalOneId,
                processNumber: inv.asset.processNumber,
                nickname: inv.asset.nickname,
                otherParty: inv.asset.otherParty,
                originalCreditor: inv.asset.originalCreditor,
                currentValue: inv.asset.currentValue,
                acquisitionValue: inv.asset.acquisitionValue,
                status: inv.asset.status,
                lastUpdate: inv.asset.updates[0] || null,
            })),
        };
    }
}

export { GetAssociateClientProcessesUseCase };
