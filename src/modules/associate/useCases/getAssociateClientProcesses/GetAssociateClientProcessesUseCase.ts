import { prisma } from '../../../../prisma';

class GetAssociateClientProcessesUseCase {
    async execute(auth0UserId: string, clientId: string) {
        const associate = await prisma.user.findUnique({
            where: { auth0UserId },
            select: { id: true },
        });
        if (!associate) throw new Error('Associado não encontrado.');

        // Confirms the client exists
        const client = await prisma.user.findUnique({
            where: { id: clientId },
            select: { id: true, name: true, email: true, profilePictureUrl: true },
        });
        if (!client) throw new Error('Cliente não encontrado.');

        const investments = await prisma.investment.findMany({
            where: {
                associateId: associate.id,
                userId: clientId,
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
                            where: {
                                OR: [
                                    { description: { contains: '#RelatórioMAA' } },
                                    { description: { contains: '#RelatorioMAA' } },
                                ],
                            },
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
