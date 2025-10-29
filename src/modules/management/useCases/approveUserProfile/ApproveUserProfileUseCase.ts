// /src/modules/management/useCases/approveUserProfile/ApproveUserProfileUseCase.ts
import { PrismaClient } from "@prisma/client";
import { legalOneApiService } from "../../../../services/legalOneApiService";

const prisma = new PrismaClient();

class ApproveUserProfileUseCase {
    async execute(userId: string): Promise<void> {
        console.log(`[ADMIN] Aprovando perfil do utilizador ID: ${userId}`);

        // 1. Busca os dados completos do utilizador no nosso DB
        const user = await prisma.user.findUniqueOrThrow({
            where: { id: userId }
        });

        // Validações de segurança
        if (!user.cpfOrCnpj || !user.email) {
            throw new Error("Perfil do utilizador está incompleto (sem CPF/CNPJ ou e-mail) e não pode ser aprovado.");
        }
        if (user.status !== 'PENDING_REVIEW') {
             throw new Error("Este utilizador não está pendente de revisão.");
        }
        // Se o utilizador já tiver um ID do Legal One, apenas o ativa
        if (user.legalOneContactId) {
            console.warn(`[ADMIN] O utilizador ${userId} já possui um legalOneContactId (${user.legalOneContactId}). Apenas a mudar o status para ACTIVE.`);
            await prisma.user.update({
                where: { id: userId },
                data: { status: "ACTIVE" }
            });
            return;
        }

        // 2. Tenta criar o Contato no Legal One
        const newContact = await legalOneApiService.createContact(
            user.name,
            user.email,
            user.cpfOrCnpj
        );
        
        // 3. VERIFICAÇÃO DE UNICIDADE (LÓGICA SÉNIOR)
        // Antes de salvar, verifica se outro utilizador já foi sincronizado com este ID.
        const existingUserWithThisId = await prisma.user.findFirst({
            where: { legalOneContactId: newContact.id }
        });

        if (existingUserWithThisId) {
            // Se já existe, lança um erro para o Admin
            throw new Error(`O ID de Contato do Legal One (${newContact.id}) já está em uso pelo utilizador ${existingUserWithThisId.email}.`);
        }

        // 4. Anexa os documentos pessoais ao novo Contato no Legal One
        if (user.personalDocumentUrls && user.personalDocumentUrls.length > 0) {
            console.log(`[ADMIN] Anexando ${user.personalDocumentUrls.length} documento(s) ao novo Contato ID: ${newContact.id}...`);
            for (const docUrl of user.personalDocumentUrls) {
                try {
                    await legalOneApiService.uploadDocumentFromUrl(docUrl, newContact.id);
                } catch (docError: any) {
                    console.error(`[ADMIN] Falha ao anexar o documento ${docUrl} ao Contato ${newContact.id}. Erro: ${docError.message}`);
                    // Não para o fluxo, apenas regista o erro
                }
            }
        }
        
        // 5. Atualiza o nosso banco de dados
        await prisma.user.update({
            where: { id: userId },
            data: {
                status: "ACTIVE",
                legalOneContactId: newContact.id // Guarda o ID do Legal One
            }
        });

        // TODO: Enviar um e-mail de "Bem-vindo, seu perfil foi aprovado!" para o utilizador.
        console.log(`[ADMIN] Perfil ${userId} aprovado com sucesso. Legal One ID: ${newContact.id}`);
    }
}

export { ApproveUserProfileUseCase };

