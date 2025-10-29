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

        // Validação de segurança
        if (!user.cpfOrCnpj || !user.email) {
            throw new Error("Perfil do utilizador está incompleto (sem CPF/CNPJ ou e-mail) e não pode ser aprovado.");
        }
        if (user.status !== 'PENDING_REVIEW') {
             throw new Error("Este utilizador não está pendente de revisão.");
        }

        // 2. Tenta criar o Contato no Legal One (como a sua sócia pediu)
        const newContact = await legalOneApiService.createContact(
            user.name,
            user.email,
            user.cpfOrCnpj
        );

        // 3. Anexa os documentos pessoais ao novo Contato no Legal One
        if (user.personalDocumentUrls && user.personalDocumentUrls.length > 0) {
            console.log(`[ADMIN] Anexando ${user.personalDocumentUrls.length} documento(s) ao novo Contato ID: ${newContact.id}...`);
            for (const docUrl of user.personalDocumentUrls) {
                try {
                    // Usa o nosso service para enviar a URL
                    await legalOneApiService.uploadDocumentFromUrl(docUrl, newContact.id);
                } catch (docError: any) {
                    console.error(`[ADMIN] Falha ao anexar o documento ${docUrl} ao Contato ${newContact.id}. Erro: ${docError.message}`);
                    // Não para o fluxo, apenas regista o erro
                }
            }
        }
        
        // 4. Atualiza o nosso banco de dados com o status "ACTIVE" e o ID do Legal One
        await prisma.user.update({
            where: { id: userId },
            data: {
                status: "ACTIVE",
            }
        });

        // TODO: Enviar um e-mail de "Bem-vindo, seu perfil foi aprovado!" para o utilizador.
        console.log(`[ADMIN] Perfil ${userId} aprovado com sucesso. Legal One ID: ${newContact.id}`);
    }
}

export { ApproveUserProfileUseCase };
