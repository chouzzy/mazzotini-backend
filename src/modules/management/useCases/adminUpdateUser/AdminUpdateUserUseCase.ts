
import { prisma } from '../../../../prisma';
import { User } from '@prisma/client';
import { legalOneApiService } from "../../../../services/legalOneApiService";



// Interface flexível para receber os dados do form
interface IAdminUpdateUserDTO {
    [key: string]: any;
}

class AdminUpdateUserUseCase {
    async execute(userId: string, data: IAdminUpdateUserDTO): Promise<User> {
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

        // 3. Atualiza no Prisma. Campo ausente fica como está; `null` enviado de propósito
        //    limpa o campo. Antes, a indicação e o associado indicado voltavam ao valor
        //    anterior quando vinham vazios, então trocar de associado cadastrado para nome
        //    manual (ou o contrário) mantinha os dois gravados.
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                ...updateData,
                birthDate: formattedBirthDate,
            }
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