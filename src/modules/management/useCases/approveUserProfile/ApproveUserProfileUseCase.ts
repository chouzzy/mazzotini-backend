// src/modules/management/useCases/approveUserProfile/ApproveUserProfileUseCase.ts
import { PrismaClient } from "@prisma/client";
import { legalOneApiService, LegalOneContact } from "../../../../services/legalOneApiService";
import axios from 'axios';

const prisma = new PrismaClient();

class ApproveUserProfileUseCase {
    async execute(userId: string): Promise<void> {
        console.log(`[ADMIN] Aprovando perfil do utilizador ID: ${userId}`);

        const user = await prisma.user.findUniqueOrThrow({
            where: { id: userId }
        });

        // Validação de segurança
        const hasDocument = user.cpfOrCnpj || user.rg;
        if (!hasDocument || !user.email) {
            throw new Error("Perfil do utilizador está incompleto (sem CPF/CNPJ ou RG) e não pode ser aprovado.");
        }
        if (user.status !== 'PENDING_REVIEW') {
             throw new Error("Este utilizador não está pendente de revisão.");
        }

        // --- VALIDAÇÃO DE DUPLICIDADE LOCAL ---
        if (user.rg) {
            const existingUserWithRG = await prisma.user.findFirst({
                where: { rg: user.rg, status: 'ACTIVE', id: { not: userId } }
            });
            if (existingUserWithRG) {
                console.warn(`[ADMIN] Falha na aprovação: O RG ${user.rg} já pertence ao usuário ${existingUserWithRG.id}.`);
                throw new Error("Este RG já está em uso por outro usuário aprovado.");
            }
        }
        if (user.cpfOrCnpj) {
            const existingUserWithCPF = await prisma.user.findFirst({
                where: { cpfOrCnpj: user.cpfOrCnpj, status: 'ACTIVE', id: { not: userId } }
            });
            if (existingUserWithCPF) {
                console.warn(`[ADMIN] Falha na aprovação: O CPF/CNPJ já pertence ao usuário ${existingUserWithCPF.id}.`);
                throw new Error("Este CPF/CNPJ já está em uso por outro usuário aprovado.");
            }
        }
        // --- FIM DA VALIDAÇÃO ---


        // =================================================================
        //  LÓGICA DE BUSCAR, ATUALIZAR OU CRIAR
        // =================================================================
        let legalOneContact: LegalOneContact | null = null; 

        // 1. Tenta encontrar pelo CPF
        if (user.cpfOrCnpj) {
            legalOneContact = await legalOneApiService.getContactByCPF(user.cpfOrCnpj);
        }

        // 2. Se NÃO achou pelo CPF E existe um RG, tenta pelo RG
        if (!legalOneContact && user.rg) {
            legalOneContact = await legalOneApiService.getContactByRG(user.rg);
        }

        // 3. Verifica o resultado
        if (legalOneContact) {
            // 3a. Se JÁ EXISTE: Atualiza (Sobrescreve) com os dados do Mazzotini
            console.log(`[ADMIN] Contato já existe no Legal One (ID: ${legalOneContact.id}). Atualizando dados...`);
            
            // CHAMA O NOVO MÉTODO DE UPDATE
            await legalOneApiService.updateContact(legalOneContact.id, user);
            
        } else {
            // 3b. Se NÃO EXISTE: Cria
            console.log(`[ADMIN] Contato não existe no Legal One. Criando...`);
            legalOneContact = await legalOneApiService.createContact(user);
        }
        // =================================================================
        
        
        // 4. Anexa os documentos pessoais
        if (user.personalDocumentUrls && user.personalDocumentUrls.length > 0) {
            console.log(`[ADMIN] Anexando ${user.personalDocumentUrls.length} documento(s) ao Contato ID: ${legalOneContact.id}...`);
            
            for (const docUrl of user.personalDocumentUrls) {
                try {
                    console.log(`[Upload] Baixando ficheiro de: ${docUrl}`);
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
                    // Loga mas não para o fluxo
                }
            }
        }
        
        // 5. Atualiza o nosso banco de dados
        await prisma.user.update({
            where: { id: userId },
            data: {
                status: "ACTIVE",
                legalOneContactId: legalOneContact.id 
            }
        });

        console.log(`[ADMIN] Perfil ${userId} aprovado com sucesso. Legal One ID: ${legalOneContact.id}`);
    }
}

export { ApproveUserProfileUseCase };