/**
 * Indicação (associado) × associado dos processos do cliente.
 *
 * A indicação do cadastro (`User.referredById`) só registra quem indicou o cliente. Quem acompanha
 * cada processo é o associado do investimento (`Investment.associateId`): é o campo que a carteira
 * edita e o que o portal do associado usa. Estas funções levam a indicação para os processos, na
 * edição do cadastro e no botão que reaplica a indicação.
 */

import { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '../../errors/AppError';

type Db = Prisma.TransactionClient | PrismaClient;

/**
 * A indicação precisa ser um associado cadastrado (papel ASSOCIATE no banco, o mesmo critério da
 * lista de associados da tela) e não pode ser o próprio cliente.
 */
export async function assertReferralAssociate(db: Db, userId: string, associateId: string): Promise<void> {
    if (associateId === userId) throw new AppError('O cliente não pode ser indicado por ele mesmo.', 400);
    const associate = await db.user.findUnique({ where: { id: associateId }, select: { role: true } });
    if (associate?.role !== 'ASSOCIATE') throw new AppError('O usuário indicado não é um associado.', 400);
}

/**
 * Leva o associado indicado para os processos do cliente. Com `investmentIds`, só esses (os que a
 * tela mostrou ao admin); sem, todos. Devolve quantos processos foram gravados com o associado.
 */
export async function applyReferralToInvestments(
    db: Db,
    userId: string,
    associateId: string | null,
    investmentIds?: string[],
): Promise<number> {
    if (!associateId) throw new AppError('Escolha um associado cadastrado para levar aos processos do cliente.', 400);
    await assertReferralAssociate(db, userId, associateId);
    const { count } = await db.investment.updateMany({
        where: { userId, ...(investmentIds ? { id: { in: investmentIds } } : {}) },
        data:  { associateId },
    });
    return count;
}
