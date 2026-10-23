
import { prisma } from '../../../../prisma';
import { User } from '@prisma/client';
import { legalOneApiService } from "../../../../services/legalOneApiService";
import { applyReferralToInvestments, assertReferralAssociate } from '../../referralInvestments';



// Interface flexível para receber os dados do form
interface IAdminUpdateUserDTO {
    [key: string]: any;
}

interface IAdminUpdateUserOptions {
    /**
     * Fecha as solicitações de alteração pendentes do usuário. Usado na edição direta do
     * admin: depois dela, aprovar uma solicitação antiga sobrescreveria os dados novos com
     * os velhos. A aprovação de uma solicitação não usa esta opção.
     */
    supersedePendingRequests?: boolean;
    /**
     * Leva o associado indicado (`referredById`) para os processos do cliente, como a carteira
     * faz processo a processo (`Investment.associateId`). A indicação sozinha só registra quem
     * indicou; o portal do associado e o detalhe do processo usam o associado de cada processo.
     * Exige um associado cadastrado.
     */
    applyReferralToInvestments?: boolean;
    /** Com `applyReferralToInvestments`, só estes investimentos (os que a tela mostrou ao admin). */
    referralInvestmentIds?: string[];
}

/** O usuário gravado e, quando o associado foi levado aos processos, quantos processos mudaram. */
type AdminUpdateUserResult = User & { investmentsUpdated?: number };

class AdminUpdateUserUseCase {
    async execute(userId: string, data: IAdminUpdateUserDTO, options: IAdminUpdateUserOptions = {}): Promise<AdminUpdateUserResult> {
        console.log(`[ADMIN UPDATE] Atualizando perfil do usuário ID: ${userId}`);

        // 1. Verifica se usuário existe
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            throw new Error("Usuário não encontrado.");
        }

        // 2. Prepara dados (converte data se necessário)
        const { birthDate, ...updateData } = data;
        let formattedBirthDate = user.birthDate;
        
        if (birthDate) {
            formattedBirthDate = new Date(birthDate);
        }

        // Uma indicação nova precisa ser um associado cadastrado, e não o próprio cliente. A que
        // não mudou passa como está, para um cadastro antigo continuar salvando
        if (typeof updateData.referredById === 'string' && updateData.referredById !== user.referredById) {
            await assertReferralAssociate(prisma, userId, updateData.referredById);
        }

        // 3. Atualiza no Prisma. Campo ausente fica como está; `null` enviado de propósito
        //    limpa o campo. Antes, a indicação e o associado indicado voltavam ao valor
        //    anterior quando vinham vazios, então trocar de associado cadastrado para nome
        //    manual (ou o contrário) mantinha os dois gravados.
        //    A edição e o fechamento das solicitações pendentes vão juntos: se um falhar,
        //    nenhum vale, e o admin não recebe erro sobre uma edição que já foi gravada.
        const updatedUser = await prisma.$transaction(async (tx) => {
            const updated = await tx.user.update({
                where: { id: userId },
                data: {
                    ...updateData,
                    birthDate: formattedBirthDate,
                }
            });

            if (options.supersedePendingRequests) {
                await tx.userProfileChangeRequest.updateMany({
                    where: { userId, status: 'PENDING' },
                    data: { status: 'REJECTED', rejectionReason: 'Substituída por uma edição direta do administrador.' },
                });
            }

            // Na mesma transação: se o associado não puder ir para os processos, a indicação
            // também não muda, e o admin decide de novo
            if (options.applyReferralToInvestments) {
                const count = await applyReferralToInvestments(tx, userId, updated.referredById, options.referralInvestmentIds);
                console.log(`[ADMIN UPDATE] Associado indicado levado para ${count} processo(s) do usuário ID: ${userId}`);
                return { ...updated, investmentsUpdated: count };
            }

            return updated;
        });

        // 4. Sincroniza com Legal One (Se o usuário já estiver vinculado)
        if (updatedUser.legalOneContactId) {
            try {
                // Busca o nome do associado para atualizar o custom field
                let associateName = undefined;
                if (updatedUser.referredById) {
                    const assoc = await prisma.user.findUnique({ where: { id: updatedUser.referredById }, select: { name: true } });
                    associateName = assoc?.name;
                } else if (updatedUser.indication) {
                    associateName = updatedUser.indication;
                }

                console.log(`[ADMIN UPDATE] Sincronizando com Legal One (Contact ID: ${updatedUser.legalOneContactId})...`);
                await legalOneApiService.updateContact(updatedUser.legalOneContactId, updatedUser, associateName);
                
            } catch (error: any) {
                console.error(`[ADMIN UPDATE] Erro ao sincronizar com Legal One:`, error.message);
                // Não quebra a requisição, apenas loga o erro de sync
            }
        }

        return updatedUser;
    }
}

export { AdminUpdateUserUseCase };