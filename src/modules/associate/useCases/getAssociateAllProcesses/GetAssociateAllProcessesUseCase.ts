import { prisma } from '../../../../prisma';

export interface AssociateProcessRow {
    investmentId: string;
    clientId: string;
    clientName: string;
    clientEmail: string;
    clientPicture: string;
    legalOneId: number;
    processNumber: string;
    nickname: string | null;
    otherParty: string | null;
    originalCreditor: string;
    currentValue: number;
    status: string;
    lastUpdateDate: string | null;
    lastUpdateDescription: string | null;
}

class GetAssociateAllProcessesUseCase {
    async execute(auth0UserId: string): Promise<AssociateProcessRow[]> {
        const associate = await prisma.user.findUnique({
            where: { auth0UserId },
            select: { id: true },
        });
        if (!associate) throw new Error('Associado não encontrado.');

        const investments = await prisma.investment.findMany({
            where: { associateId: associate.id },
            select: {
                id: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        profilePictureUrl: true,
                    },
                },
                asset: {
                    select: {
                        legalOneId: true,
                        processNumber: true,
                        nickname: true,
                        otherParty: true,
                        originalCreditor: true,
                        currentValue: true,
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
                            select: { date: true, description: true },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return investments.map(inv => {
            const u = inv.user;
            const a = inv.asset;
            const displayName = u.name || u.email;
            const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random&color=fff&size=128`;
            const lastUpdate = a.updates[0] ?? null;

            return {
                investmentId: inv.id,
                clientId: u.id,
                clientName: displayName,
                clientEmail: u.email,
                clientPicture: u.profilePictureUrl || fallback,
                legalOneId: a.legalOneId,
                processNumber: a.processNumber,
                nickname: a.nickname,
                otherParty: a.otherParty,
                originalCreditor: a.originalCreditor,
                currentValue: a.currentValue,
                status: a.status,
                lastUpdateDate: lastUpdate?.date?.toISOString() ?? null,
                lastUpdateDescription: lastUpdate?.description ?? null,
            };
        });
    }
}

export { GetAssociateAllProcessesUseCase };
