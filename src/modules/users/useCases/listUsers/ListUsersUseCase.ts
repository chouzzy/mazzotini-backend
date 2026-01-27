import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export type UserSelectItem = {
    value: string; // ID do Prisma
    label: string; // Nome
    role?: string; 
};

class ListUsersUseCase {
    async execute(): Promise<UserSelectItem[]> {
        console.log("[ListUsers] Buscando usuários para dropdown (Banco Local)...");

        const users = await prisma.user.findMany({
            // Se quiser filtrar apenas ativos: where: { status: 'ACTIVE' },
            orderBy: { name: 'asc' },
            select: {
                id: true,
                name: true,
                email: true,
                role: true
            }
        });

        const dropdownItems: UserSelectItem[] = users.map(user => ({
            value: user.id, 
            label: user.name || user.email,
            role: user.role || undefined
        }));

        return dropdownItems;
    }
}

export { ListUsersUseCase };