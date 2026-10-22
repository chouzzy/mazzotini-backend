/**
 * Indicação (associado) × associado dos processos do cliente.
 *
 * A indicação do cadastro (`User.referredById`) só registra quem indicou o cliente. Quem acompanha
 * cada processo é o associado do investimento (`Investment.associateId`): é o campo que a carteira
 * edita e o que o portal do associado usa. Estas funções levam a indicação para os processos, na
 * edição do cadastro e no botão que reaplica a indicação.
 */

import { Prisma, PrismaClient } from '@prisma/client';

type Db = Prisma.TransactionClient | PrismaClient;

/**
 * A indicação precisa ser um associado cadastrado (papel ASSOCIATE no banco, o mesmo critério da
 * lista de associados da tela) e não pode ser o próprio cliente.
 */
export async function assertReferralAssociate(db: Db, userId: string, associateId: string): Promise<void> {
    if (associateId === userId) throw new Error('O cliente não pode ser indicado por ele mesmo.');
    const associate = await db.user.findUnique({ where: { id: associateId }, select: { role: true } });
    if (associate?.role !== 'ASSOCIATE') throw new Error('O usuário indicado não é um associado.');
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
    if (!associateId) throw new Error('Escolha um associado cadastrado para levar aos processos do cliente.');
    await assertReferralAssociate(db, userId, associateId);
    const { count } = await db.investment.updateMany({
        where: { userId, ...(investmentIds ? { id: { in: investmentIds } } : {}) },
        data:  { associateId },
    });
    return count;
}
