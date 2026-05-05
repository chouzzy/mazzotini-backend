/**
 * ApproveUserProfileUseCase.ts — Aprovação de Perfil de Usuário
 *
 * Fluxo de aprovação executado pelo administrador quando um usuário com status
 * `PENDING_REVIEW` tem seu cadastro validado. O processo é composto por 4 etapas:
 *
 * ## Etapa 1 — Validação Pré-aprovação
 * Verifica se o usuário possui os dados mínimos obrigatórios (documento + e-mail)
 * e se está no status correto (`PENDING_REVIEW`). Lança AppError 409/422 se não.
 *
 * ## Etapa 2 — Gestão de Contato no Legal One
 * Busca o contato no Legal One pelo CPF/CNPJ (ou RG como fallback).
 * - Se encontrar: atualiza os dados do contato existente.
 * - Se não encontrar: cria um novo contato.
 * Em ambos os casos, o campo customizado "Associado" é preenchido com o nome
 * do associado vinculador (referredById → nome no banco, ou campo `indication`).
 *
 * ## Etapa 3 — Replicação de Documentos (GED)
 * Para cada documento pessoal enviado pelo usuário (URLs no Spaces/S3):
 *  a. Baixa o arquivo via HTTP (arraybuffer)
 *  b. Obtém um container de upload temporário no Legal One
 *  c. Envia o arquivo para esse container
 *  d. Finaliza o documento, vinculando-o ao contato (com tag #DocumentoMAA)
 * Erros individuais de documentos são logados mas NÃO interrompem a aprovação.
 *
 * ## Etapa 4 — Finalização Local
 * Atualiza o status do usuário para `ACTIVE`, salva o `legalOneContactId` retornado
 * pela API e atribui a role `INVESTOR` ao perfil.
 *
 * @throws {AppError} 422 — Perfil incompleto (sem documentos ou e-mail)
 * @throws {AppError} 409 — Usuário não está em `PENDING_REVIEW`
 */


import { prisma } from '../../../../prisma';
import { legalOneApiService } from "../../../../services/legalOneApiService";
import { AppError } from "../../../../errors/AppError";
import axios from 'axios';
import { LegalOneContact } from "../../../../services/legalOneTypes";



class ApproveUserProfileUseCase {
    async execute(userId: string): Promise<void> {
        console.log(`[ADMIN] Aprovando perfil do utilizador ID: ${userId}`);

        const user = await prisma.user.findUniqueOrThrow({
            where: { id: userId }
        });

        // Validação básica
        const hasDocument = user.cpfOrCnpj || user.rg;
        if (!hasDocument || !user.email) {
            throw new AppError("Perfil incompleto (sem documentos ou e-mail).", 422);
        }
        if (user.status !== 'PENDING_REVIEW') {
            throw new AppError("Este usuário não está pendente de revisão.", 409);
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
                legalOneContactId: legalOneContact.id,
                role: "INVESTOR",
                approvedAt: new Date(),
            }
        });

        console.log(`[ADMIN] Perfil ${userId} aprovado e sincronizado com sucesso.`);
    }
}

export { ApproveUserProfileUseCase };