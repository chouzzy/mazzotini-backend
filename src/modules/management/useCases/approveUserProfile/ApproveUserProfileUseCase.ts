import { PrismaClient } from "@prisma/client";
import { legalOneApiService } from "../../../../services/legalOneApiService";
import axios from 'axios';

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
            throw new Error("Perfil do utilizador está incompleto e não pode ser aprovado.");
        }
        if (user.status !== 'PENDING_REVIEW') {
             throw new Error("Este utilizador não está pendente de revisão.");
        }

        // --- VALIDAÇÃO DE DUPLICIDADE (RG/CPF) ---
        if (user.rg) {
            const existingUserWithRG = await prisma.user.findFirst({
                where: {
                    rg: user.rg,
                    status: 'ACTIVE', 
                    id: { not: userId }
                }
            });

            if (existingUserWithRG) {
                console.warn(`[ADMIN] Falha na aprovação: O RG ${user.rg} já pertence ao usuário ${existingUserWithRG.id}.`);
                throw new Error("Este RG já está em uso por outro usuário aprovado.");
            }
        }
        
        if (user.cpfOrCnpj) {
            const existingUserWithCPF = await prisma.user.findFirst({
                where: {
                    cpfOrCnpj: user.cpfOrCnpj,
                    status: 'ACTIVE',
                    id: { not: userId }
                }
            });
            if (existingUserWithCPF) {
                console.warn(`[ADMIN] Falha na aprovação: O CPF/CNPJ já pertence ao usuário ${existingUserWithCPF.id}.`);
                throw new Error("Este CPF/CNPJ já está em uso por outro usuário aprovado.");
            }
        }
        // --- FIM DA VALIDAÇÃO ---


        // 2. Tenta criar o Contato no Legal One
        const newContact = await legalOneApiService.createContact(user);
        
        // 3. Anexa os documentos pessoais ao novo Contato no Legal One
        if (user.personalDocumentUrls && user.personalDocumentUrls.length > 0) {
            console.log(`[ADMIN] Anexando ${user.personalDocumentUrls.length} documento(s) ao novo Contato ID: ${newContact.id}...`);
            
            for (const docUrl of user.personalDocumentUrls) {
                try {
                    // Etapa 3a: Fazer o download do ficheiro
                    console.log(`[Upload] Baixando ficheiro de: ${docUrl}`);
                    const fileResponse = await axios.get(docUrl, { responseType: 'arraybuffer' });
                    const fileBuffer = Buffer.from(fileResponse.data);
                    
                    const originalFileName = decodeURIComponent(docUrl.split('/').pop()?.split('-').pop() || 'documento.pdf');
                    
                    // **CORREÇÃO APLICADA:** Enviar 'pdf', e não '.pdf'
                    const fileExtension = originalFileName.split('.').pop() || 'pdf'; 
                    
                    const mimeType = fileResponse.headers['content-type'] || 'application/octet-stream';

                    // Etapa 3b: Pedir o container ao Legal One
                    const container = await legalOneApiService.getUploadContainer(fileExtension);
                    
                    // Etapa 3c: Fazer o upload para o container (Azure) do Legal One
                    await legalOneApiService.uploadFileToContainer(container.externalId, fileBuffer, mimeType);
                    
                    // Etapa 3d: Finalizar e anexar o documento no Legal One
                    await legalOneApiService.finalizeDocument(container.fileName, originalFileName, newContact.id);

                } catch (docError: any) {
                    // --- MELHORIA NO LOG DE ERRO ---
                    // Mostra a mensagem de erro simples
                    console.log('[ADMIN] Erro ao anexar documento:', JSON.stringify(docError));
                    console.error(`[ADMIN] Falha ao anexar o documento ${docUrl} ao Contato ${newContact.id}. Erro:`, docError.message);
                    
                    // Mostra a resposta JSON completa do Legal One, se existir
                    if (docError.response && docError.response.data) {
                        console.error("[ADMIN] Resposta de erro detalhada do Legal One:", JSON.stringify(docError.response.data, null, 2));
                    }
                    // Não para o fluxo, apenas regista o erro
                }
            }
        }
        
        // 4. Atualiza o nosso banco de dados
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