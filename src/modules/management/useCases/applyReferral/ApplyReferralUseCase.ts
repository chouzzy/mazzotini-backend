import { prisma } from '../../../../prisma';
import { applyReferralToInvestments } from '../../referralInvestments';

/**
 * Leva a indicação já gravada do cliente para os processos dele, sem editar o cadastro: para os
 * processos que chegaram depois da troca da indicação, ou para quem escolheu "Só a indicação"
 * e mudou de ideia. Com `investmentIds`, só esses (os que a tela mostrou ao admin).
 */
class ApplyReferralUseCase {
    async execute(userId: string, investmentIds?: string[]): Promise<{ investmentsUpdated: number }> {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, referredById: true } });
        if (!user) throw new Error('Usuário não encontrado.');

        const investmentsUpdated = await applyReferralToInvestments(prisma, userId, user.referredById, investmentIds);
        console.log(`[APPLY REFERRAL] Associado indicado levado para ${investmentsUpdated} processo(s) do usuário ID: ${userId}`);
        return { investmentsUpdated };
    }
}

export { ApplyReferralUseCase };
