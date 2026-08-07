import { prisma } from '../../../../prisma';




export type UserSelectItem = {
    value: string; // ID do Prisma
    label: string; // Nome
    role?: string;
    indication?: string | null;    // nome do associado digitado manualmente
    referredByName?: string | null; // nome do associado vinculado como User
};

class ListUsersUseCase {
    async execute(): Promise<UserSelectItem[]> {
        console.log("[ListUsers] Buscando usuários para dropdown (Banco Local)...");

        const users = await prisma.user.findMany({
            where: {
                // Exclui shadow users criados pela importação do LegalOne.
                // Usa contains:'legalone' (sem | que é special char em regex no MongoDB)
                // pois auth0UserId de shadow users começa com 'legalone|import|'.
                NOT: { auth0UserId: { contains: 'legalone', mode: 'insensitive' } },
            },
            orderBy: { name: 'asc' },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                indication: true,
                referredBy: { select: { name: true } }
            }
        });

        const dropdownItems: UserSelectItem[] = users.map(user => ({
            value: user.id,
            label: user.name || user.email,
            role: user.role || undefined,
            indication: user.indication || null,
            referredByName: user.referredBy?.name || null,
        }));

        return dropdownItems;
    }
}

export { ListUsersUseCase };