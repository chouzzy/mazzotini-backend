import { prisma } from '../../../../prisma';
// /src/modules/management/useCases/listPendingUsers/ListPendingUsersUseCase.ts




// Usamos o tipo User completo, pois o Admin precisará de todos os dados
// para tomar a decisão de aprovação.
class ListPendingUsersUseCase {
    async execute(): Promise<User[]> {
        console.log("[ADMIN] Buscando perfis pendentes de revisão...");

        const users = await prisma.user.findMany({
            where: {
                status: "PENDING_REVIEW"
            },
            orderBy: {
                updatedAt: 'asc' // Mostra os mais antigos primeiro
            },
            include: {
                referredBy: { select: { name: true } }
            }
        });

        console.log(`[ADMIN] ${users.length} perfis pendentes encontrados.`);
        return users;
    }
}

export { ListPendingUsersUseCase };
