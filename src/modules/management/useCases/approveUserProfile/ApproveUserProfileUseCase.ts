// /src/modules/management/useCases/approveUserProfile/ApproveUserProfileUseCase.ts
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
        if (user.legalOneContactId) {
            console.warn(`[ADMIN] O utilizador ${userId} já possui um legalOneContactId (${user.legalOneContactId}). Apenas a mudar o status para ACTIVE.`);
            await prisma.user.update({
                where: { id: userId },
                data: { status: "ACTIVE" }
            });
            return;
        }

        // // 2. Tenta criar o Contato no Legal One (passando o objeto 'user' completo)
        // const newContact = await legalOneApiService.createContact(user);
        
        // // 3. Anexa os documentos pessoais ao novo Contato no Legal One (FLUXO CORRIGIDO)
        // if (user.personalDocumentUrls && user.personalDocumentUrls.length > 0) {
        //     console.log(`[ADMIN] Anexando ${user.personalDocumentUrls.length} documento(s) ao novo Contato ID: ${newContact.id}...`);
            
        //     for (const docUrl of user.personalDocumentUrls) {
        //         try {
        //             // Etapa 3a: Fazer o download do ficheiro do nosso DO Spaces
        //             console.log(`[Upload] Baixando ficheiro de: ${docUrl}`);
        //             const fileResponse = await axios.get(docUrl, { responseType: 'arraybuffer' });
        //             const fileBuffer = Buffer.from(fileResponse.data);
                    
        //             const originalFileName = decodeURIComponent(docUrl.split('/').pop()?.split('-').pop() || 'documento.pdf');
        //             const fileExtension = originalFileName.split('.').pop() || 'pdf';
        //             const mimeType = fileResponse.headers['content-type'] || 'application/octet-stream';

        //             // Etapa 3b: Pedir o container ao Legal One
        //             const container = await legalOneApiService.getUploadContainer(fileExtension);
                    
        //             // Etapa 3c: Fazer o upload para o container (Azure) do Legal One
        //             await legalOneApiService.uploadFileToContainer(container.externalId, fileBuffer, mimeType);
                    
        //             // Etapa 3d: Finalizar e anexar o documento no Legal One
        //             await legalOneApiService.finalizeDocument(container.fileName, originalFileName, newContact.id);

        //         } catch (docError: any) {
        //             console.error(`[ADMIN] Falha ao anexar o documento ${docUrl} ao Contato ${newContact.id}. Erro:`, docError.message);
        //             // Não para o fluxo, apenas regista o erro
        //         }
        //     }
        // }
        
        // 4. Atualiza o nosso banco de dados
        await prisma.user.update({
            where: { id: userId },
            data: {
                status: "ACTIVE",
                // legalOneContactId: newContact.id // Guarda o ID do Legal One
            }
        });

        // TODO: Enviar um e-mail de "Bem-vindo, seu perfil foi aprovado!" para o utilizador.
        // console.log(`[ADMIN] Perfil ${userId} aprovado com sucesso. Legal One ID: ${newContact.id}`);
    }
}

export { ApproveUserProfileUseCase };

