import { prisma } from '../../../../prisma';

export interface AssociateClient {
    id: string;
    name: string;
    email: string;
    picture: string;
    cpfOrCnpj: string | null;
    processCount: number;
}

class GetAssociateDashboardUseCase {
    async execute(auth0UserId: string): Promise<AssociateClient[]> {
        const associate = await prisma.user.findUnique({
            where: { auth0UserId },
            select: { id: true },
        });
        if (!associate) throw new Error('Associado não encontrado.');

        const investments = await prisma.investment.findMany({
            where: { associateId: associate.id },
            select: {
                userId: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        profilePictureUrl: true,
                        cpfOrCnpj: true,
                    },
                },
            },
        });

        const clientsMap = new Map<string, AssociateClient>();

        for (const inv of investments) {
            const u = inv.user;
            if (!clientsMap.has(u.id)) {
                const displayName = u.name || u.email;
                const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random&color=fff&size=128`;
                clientsMap.set(u.id, {
                    id: u.id,
                    name: displayName,
                    email: u.email,
                    picture: u.profilePictureUrl || fallback,
                    cpfOrCnpj: u.cpfOrCnpj,
                    processCount: 0,
                });
            }
            clientsMap.get(u.id)!.processCount++;
        }

        return Array.from(clientsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }
}

export { GetAssociateDashboardUseCase };
