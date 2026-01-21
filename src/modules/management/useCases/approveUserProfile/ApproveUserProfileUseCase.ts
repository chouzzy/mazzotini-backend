import { PrismaClient } from "@prisma/client";
import { legalOneApiService } from "../../../../services/legalOneApiService";
import axios from 'axios';
import { LegalOneContact } from "../../../../services/legalOneTypes";

const prisma = new PrismaClient();

class ApproveUserProfileUseCase {
    async execute(userId: string): Promise<void> {
        console.log(`[ADMIN] Aprovando perfil do utilizador ID: ${userId}`);

        const user = await prisma.user.findUniqueOrThrow({
            where: { id: userId }
        });

        // Validação básica
        const hasDocument = user.cpfOrCnpj || user.rg;
        if (!hasDocument || !user.email) {
            throw new Error("Perfil incompleto (sem documentos ou e-mail).");
        }
        if (user.status !== 'PENDING_REVIEW') {
             throw new Error("Este utilizador não está pendente de revisão.");
        }

        // --- 1. RESOLVER NOME DO ASSOCIADO (Para enviar ao Legal One) ---
        let associateName: string | undefined;

        if (user.referredById) {
            const associateUser = await prisma.user.findUnique({
                where: { id: user.referredById },
                select: { name: true }
            });
            if (associateUser) associateName = associateUser.name;
        } else if (user.indication) {
            associateName = user.indication;
        }
        
        if (associateName) console.log(`[ADMIN] Associado vinculado: "${associateName}"`);

        // --- 2. GESTÃO DO CONTATO NO LEGAL ONE ---
        let legalOneContact: LegalOneContact | null = null; 

        // Tenta achar por CPF/CNPJ
        if (user.cpfOrCnpj) {
            legalOneContact = await legalOneApiService.getContactByCPF(user.cpfOrCnpj);
        }
        // Fallback para RG
        if (!legalOneContact && user.rg) {
            legalOneContact = await legalOneApiService.getContactByRG(user.rg);
        }

        if (legalOneContact) {
            console.log(`[ADMIN] Contato já existe (ID: ${legalOneContact.id}). Atualizando...`);
            // Atualiza dados e o campo customizado do associado
            await legalOneApiService.updateContact(legalOneContact.id, user, associateName);
        } else {
            console.log(`[ADMIN] Criando novo contato...`);
            // Cria e já define o associado
            legalOneContact = await legalOneApiService.createContact(user, associateName);
        }
        
        // --- 3. REPLICAÇÃO DOS DOCUMENTOS (GED) ---
        if (user.personalDocumentUrls && user.personalDocumentUrls.length > 0) {
            console.log(`[ADMIN] Replicando ${user.personalDocumentUrls.length} documento(s) para o Legal One...`);
            
            for (const docUrl of user.personalDocumentUrls) {
                try {
                    // a. Baixa o arquivo do Spaces (Stream/Buffer)
                    const fileResponse = await axios.get(docUrl, { responseType: 'arraybuffer' });
                    const fileBuffer = Buffer.from(fileResponse.data);
                    
                    // b. Prepara metadados
                    const originalFileName = decodeURIComponent(docUrl.split('/').pop()?.split('-').pop() || 'documento.pdf');
                    const fileExtension = originalFileName.split('.').pop() || 'pdf'; 
                    const mimeType = fileResponse.headers['content-type'] || 'application/octet-stream';

                    // c. Envia para o Legal One (Fluxo de 3 passos)
                    const container = await legalOneApiService.getUploadContainer(fileExtension);
                    await legalOneApiService.uploadFileToContainer(container.externalId, fileBuffer, mimeType);
                    
                    // O finalizeDocument já adiciona a tag #DocumentoMAA automaticamente
                    await legalOneApiService.finalizeDocument(container.fileName, originalFileName, legalOneContact.id);
                    
                    console.log(`[ADMIN] Documento '${originalFileName}' replicado com sucesso.`);

                } catch (docError: any) {
                    console.error(`[ADMIN] Falha ao replicar documento '${docUrl}':`, docError.message);
                    // Não paramos o fluxo de aprovação por erro de documento, mas logamos
                }
            }
        }
        
        // --- 4. FINALIZAÇÃO LOCAL ---
        await prisma.user.update({
            where: { id: userId },
            data: {
                status: "ACTIVE",
                legalOneContactId: legalOneContact.id 
            }
        });

        console.log(`[ADMIN] Perfil ${userId} aprovado e sincronizado com sucesso.`);
    }
}

export { ApproveUserProfileUseCase };