// src/modules/management/useCases/approveUserProfile/ApproveUserProfileUseCase.ts
import { PrismaClient } from "@prisma/client";
import { legalOneApiService, LegalOneContact } from "../../../../services/legalOneApiService";
import axios from 'axios';

const prisma = new PrismaClient();

class ApproveUserProfileUseCase {
    async execute(userId: string): Promise<void> {
        console.log(`[ADMIN] Aprovando perfil do utilizador ID: ${userId}`);

        // 1. Busca os dados completos do utilizador no nosso DB
        const user = await prisma.user.findUniqueOrThrow({
            where: { id: userId }
        });

        // =================================================================
        //  CORREÇÃO 1 (Bug da Validação)
        //  Agora verifica se o e-mail E (CPF OU RG) existem.
        // =================================================================
        const documentId = user.cpfOrCnpj || user.rg; // Pega o primeiro documento disponível
        if ((!documentId) || !user.email) {
            throw new Error("Perfil do utilizador está incompleto (sem CPF/RG ou e-mail) e não pode ser aprovado.");
        }
        // =================================================================

        if (user.status !== 'PENDING_REVIEW') {
             throw new Error("Este utilizador não está pendente de revisão.");
        }

        // --- VALIDAÇÃO DE DUPLICIDADE (RG/CPF) LOCAL ---
        // (A sua lógica aqui já estava correta, mas vamos garantir
        //  que ela use a variável 'documentId' para o CPF/CNPJ)
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
        if (user.cpfOrCnpj) { // O CPF/CNPJ ainda é o 'documentId' principal
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


        // =================================================================
        //  CORREÇÃO 2 (Bug da Busca)
        //  Usamos a variável 'documentId' para fazer UMA busca.
        // =================================================================
        let legalOneContact: LegalOneContact; // O contato que vamos usar

        // 2. Tenta encontrar o contato no Legal One (pelo CPF ou RG)
        //    (A função getContactByCPF busca no 'personStateIdentificationNumber',
        //     que é onde o 'createContact' salva o CPF ou o RG)
        const existingContact = await legalOneApiService.getContactByCPF(documentId);

        if (existingContact) {
            // 2a. Se JÁ EXISTE: Reutiliza
            console.log(`[ADMIN] Contato já existe no Legal One (ID: ${existingContact.id}). Reutilizando.`);
            legalOneContact = existingContact;
            
        } else {
            // 2b. Se NÃO EXISTE: Cria
            console.log(`[ADMIN] Contato não existe no Legal One. Criando...`);
            legalOneContact = await legalOneApiService.createContact(user);
        }
        // =================================================================
        //  FIM DA NOVA LÓGICA
        // =================================================================

        
        // 3. Anexa os documentos pessoais ao Contato (novo ou existente)
        if (user.personalDocumentUrls && user.personalDocumentUrls.length > 0) {
            console.log(`[ADMIN] Anexando ${user.personalDocumentUrls.length} documento(s) ao Contato ID: ${legalOneContact.id}...`);
            
            for (const docUrl of user.personalDocumentUrls) {
                try {
                    // Lógica de upload
                    console.log(`[Upload] Baixando ficheiro de: ${docUrl}`);
                    const fileResponse = await axios.get(docUrl, { responseType: 'arraybuffer' });
                    const fileBuffer = Buffer.from(fileResponse.data);
                    const originalFileName = decodeURIComponent(docUrl.split('/').pop()?.split('-').pop() || 'documento.pdf');
                    const fileExtension = originalFileName.split('.').pop() || 'pdf'; 
                    const mimeType = fileResponse.headers['content-type'] || 'application/octet-stream';

                    const container = await legalOneApiService.getUploadContainer(fileExtension);
                    await legalOneApiService.uploadFileToContainer(container.externalId, fileBuffer, mimeType);
                    
                    // Usa o ID (novo ou existente)
                    await legalOneApiService.finalizeDocument(container.fileName, originalFileName, legalOneContact.id);

                } catch (docError: any) {
                    // Log de erro
                    console.log('[ADMIN] Erro ao anexar documento:', JSON.stringify(docError));
                    console.error(`[ADMIN] Falha ao anexar o documento ${docUrl} ao Contato ${legalOneContact.id}. Erro:`, docError.message);
                    if (docError.response && docError.response.data) {
                        console.error("[ADMIN] Resposta de erro detalhada do Legal One:", JSON.stringify(docError.response.data, null, 2));
                    }
                }
            }
        }
        
        // 4. Atualiza o nosso banco de dados
        await prisma.user.update({
            where: { id: userId },
            data: {
                status: "ACTIVE",
                legalOneContactId: legalOneContact.id // Guarda o ID (novo ou existente)
            }
        });

        console.log(`[ADMIN] Perfil ${userId} aprovado com sucesso. Legal One ID: ${legalOneContact.id}`);
    }
}

export { ApproveUserProfileUseCase };