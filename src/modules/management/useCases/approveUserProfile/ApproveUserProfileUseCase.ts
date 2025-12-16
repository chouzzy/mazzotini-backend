import { PrismaClient } from "@prisma/client";
import { legalOneApiService } from "../../../../services/legalOneApiService";
import axios from 'axios';
import { LegalOneContact } from "../../../../services/legalOneTypes";

const prisma = new PrismaClient();

class ApproveUserProfileUseCase {
    async execute(userId: string): Promise<void> {
        console.log(`[ADMIN] Aprovando perfil do utilizador ID: ${userId}`);

        // 1. Busca os dados completos do utilizador
        const user = await prisma.user.findUniqueOrThrow({
            where: { id: userId }
        });

        const hasDocument = user.cpfOrCnpj || user.rg;
        if (!hasDocument || !user.email) {
            throw new Error("Perfil do utilizador está incompleto (sem CPF/CNPJ ou RG) e não pode ser aprovado.");
        }
        if (user.status !== 'PENDING_REVIEW') {
             throw new Error("Este utilizador não está pendente de revisão.");
        }

        // --- VALIDAÇÃO DE DUPLICIDADE ---
        if (user.rg) {
            const existingUserWithRG = await prisma.user.findFirst({
                where: { rg: user.rg, status: 'ACTIVE', id: { not: userId } }
            });
            if (existingUserWithRG) {
                throw new Error("Este RG já está em uso por outro usuário aprovado.");
            }
        }
        if (user.cpfOrCnpj) {
            const existingUserWithCPF = await prisma.user.findFirst({
                where: { cpfOrCnpj: user.cpfOrCnpj, status: 'ACTIVE', id: { not: userId } }
            });
            if (existingUserWithCPF) {
                throw new Error("Este CPF/CNPJ já está em uso por outro usuário aprovado.");
            }
        }

        // =================================================================
        //  RESOLVER NOME DO ASSOCIADO (Para o Custom Field)
        // =================================================================
        let associateName: string | undefined;

        if (user.referredById) {
            // Se tem ID, busca o nome do associado no banco
            const associateUser = await prisma.user.findUnique({
                where: { id: user.referredById },
                select: { name: true }
            });
            if (associateUser) {
                associateName = associateUser.name;
            }
        } else if (user.indication) {
            // Se foi indicação manual
            associateName = user.indication;
        }

        if (associateName) {
            console.log(`[ADMIN] Associado identificado para este contato: "${associateName}"`);
        }
        // =================================================================


        let legalOneContact: LegalOneContact | null = null; 

        // 2. Busca Dupla (CPF ou RG)
        if (user.cpfOrCnpj) {
            legalOneContact = await legalOneApiService.getContactByCPF(user.cpfOrCnpj);
        }
        if (!legalOneContact && user.rg) {
            legalOneContact = await legalOneApiService.getContactByRG(user.rg);
        }

        // 3. Cria ou Atualiza
        if (legalOneContact) {
            console.log(`[ADMIN] Contato já existe (ID: ${legalOneContact.id}). Atualizando...`);
            // Passamos o associateName
            await legalOneApiService.updateContact(legalOneContact.id, user, associateName);
        } else {
            console.log(`[ADMIN] Criando novo contato...`);
            // Passamos o associateName
            legalOneContact = await legalOneApiService.createContact(user, associateName);
        }
        
        // 4. Documentos
        if (user.personalDocumentUrls && user.personalDocumentUrls.length > 0) {
            console.log(`[ADMIN] Anexando documentos...`);
            for (const docUrl of user.personalDocumentUrls) {
                try {
                    const fileResponse = await axios.get(docUrl, { responseType: 'arraybuffer' });
                    const fileBuffer = Buffer.from(fileResponse.data);
                    const originalFileName = decodeURIComponent(docUrl.split('/').pop()?.split('-').pop() || 'documento.pdf');
                    const fileExtension = originalFileName.split('.').pop() || 'pdf'; 
                    const mimeType = fileResponse.headers['content-type'] || 'application/octet-stream';

                    const container = await legalOneApiService.getUploadContainer(fileExtension);
                    await legalOneApiService.uploadFileToContainer(container.externalId, fileBuffer, mimeType);
                    await legalOneApiService.finalizeDocument(container.fileName, originalFileName, legalOneContact.id);
                } catch (docError: any) {
                    console.error(`[ADMIN] Falha ao anexar documento:`, docError.message);
                }
            }
        }
        
        // 5. Finaliza no Banco Local
        await prisma.user.update({
            where: { id: userId },
            data: {
                status: "ACTIVE",
                legalOneContactId: legalOneContact.id 
            }
        });

        console.log(`[ADMIN] Perfil ${userId} aprovado com sucesso.`);
    }
}

export { ApproveUserProfileUseCase };