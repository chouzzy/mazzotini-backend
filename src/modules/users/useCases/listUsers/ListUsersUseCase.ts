// src/modules/users/useCases/listUsers/ListUsersUseCase.ts
import { PrismaClient, User } from '@prisma/client';

const prisma = new PrismaClient();

// Definimos o tipo de retorno para não expor dados sensíveis.
type UserForList = Pick<User, 'id' | 'name' | 'email'>;

class ListUsersUseCase {
    async execute(): Promise<UserForList[]> {
        console.log("🔍 Buscando todos os usuários...");

        const users = await prisma.user.findMany({
            // Selecionamos apenas os campos necessários para o formulário.
            select: {
                id: true,
                name: true,
                email: true,
            },
            // Ordenamos por nome para uma melhor experiência no dropdown.
            orderBy: {
                name: 'asc',
            },
        });

        console.log(`✅ ${users.length} usuários encontrados.`);
        return users;
    }
}

export { ListUsersUseCase };