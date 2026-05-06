import { prisma } from '../../../../prisma';

interface IRequest {
    userId: string;
    associateSequence: number | null;
}

class UpdateAssociateCodeUseCase {
    async execute({ userId, associateSequence }: IRequest): Promise<void> {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
        if (!user) throw new Error('Usuário não encontrado.');
        if (user.role !== 'ASSOCIATE') throw new Error('Este usuário não é um Associado.');

        if (associateSequence !== null) {
            const conflict = await prisma.user.findFirst({
                where: { associateSequence, id: { not: userId } },
                select: { name: true },
            });
            if (conflict) {
                throw new Error(`O código ${String(associateSequence).padStart(3, '0')} já está em uso por ${conflict.name}.`);
            }
        }

        await prisma.user.update({
            where: { id: userId },
            data: { associateSequence },
        });

        console.log(`[ASSOCIATE CODE] Código do associado ${userId} atualizado para ${associateSequence}.`);
    }
}

export { UpdateAssociateCodeUseCase };
