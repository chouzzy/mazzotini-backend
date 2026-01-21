import { PrismaClient } from "@prisma/client";
import { fileUploadService } from "../../../../services/fileUploadService";
import { legalOneApiService } from "../../../../services/legalOneApiService";
import fs from 'fs'; // Necessário para ler o arquivo se estiver em disco

const prisma = new PrismaClient();

interface IRequest {
    userId: string;
    file: Express.Multer.File;
    assetId?: string; // NOVO: Opcional para vincular o nome do processo
}

class UploadInvestmentDocumentUseCase {
    async execute({ userId, file, assetId }: IRequest): Promise<string> {
        // 1. Busca dados do usuário (incluindo CPF/RG e ID LegalOne para a replicação)
        const user = await prisma.user.findUniqueOrThrow({ 
            where: { id: userId }, 
            select: { id: true, legalOneContactId: true, cpfOrCnpj: true, rg: true }
        });

        console.log(`[UPLOAD INV] Upload de documento de investimento para user: ${user.id}`);

        // 2. Upload para o nosso Storage (Spaces)
        const folder = `users/${user.id}/investments/documents`;
        
        // Suporte híbrido para MemoryStorage (buffer) ou DiskStorage (path)
        const fileContent = file.path || file.buffer;
        
        const fileUrl = await fileUploadService.upload(fileContent, file.originalname, folder, file.mimetype);

        // 3. REPLICAÇÃO PARA LEGAL ONE (GED DO CONTATO)
        try {
            let targetContactId = user.legalOneContactId;

            // Lógica de Fallback: Se não tiver ID salvo, busca pelo CPF/CNPJ
            if (!targetContactId && user.cpfOrCnpj) {
                console.log(`[UPLOAD INV] ID Legal One não encontrado. Buscando por CPF: ${user.cpfOrCnpj}`);
                const contact = await legalOneApiService.getContactByCPF(user.cpfOrCnpj);
                if (contact) {
                    targetContactId = contact.id;
                    // Salva para o futuro
                    await prisma.user.update({ where: { id: userId }, data: { legalOneContactId: contact.id } });
                }
            }
            
            // Lógica de Fallback: Tenta RG
            if (!targetContactId && user.rg) {
                const contact = await legalOneApiService.getContactByRG(user.rg);
                if (contact) {
                    targetContactId = contact.id;
                    await prisma.user.update({ where: { id: userId }, data: { legalOneContactId: contact.id } });
                }
            }

            if (targetContactId) {
                console.log(`[UPLOAD INV] Replicando documento para o GED do Legal One (Contact ID: ${targetContactId})...`);
                
                // --- FORMATAÇÃO DO NOME (Com Processo) ---
                let fileNameForLegalOne = file.originalname;

                if (assetId) {
                    const asset = await prisma.creditAsset.findUnique({
                        where: { id: assetId },
                        select: { processNumber: true }
                    });

                    if (asset) {
                        // Adiciona " - PROCESSO - " antes do nome. 
                        // O prefixo "#DocumentoMAA" já é adicionado pelo serviço 'finalizeDocument', 
                        // resultando em: "#DocumentoMAA - 0012345... - Arquivo.pdf"
                        fileNameForLegalOne = `- ${asset.processNumber} - ${file.originalname}`;
                    }
                }
                // -----------------------------------------
                
                const extension = file.originalname.split('.').pop() || 'pdf';
                const container = await legalOneApiService.getUploadContainer(extension);
                
                // Garante que temos um Buffer para enviar ao Legal One
                let bufferToSend = file.buffer;
                if (!bufferToSend && file.path) {
                    bufferToSend = fs.readFileSync(file.path);
                }

                if (bufferToSend) {
                    await legalOneApiService.uploadFileToContainer(container.externalId, bufferToSend, file.mimetype);
                    // Usa o nome formatado aqui
                    await legalOneApiService.finalizeDocument(container.fileName, fileNameForLegalOne, targetContactId);
                    console.log(`[UPLOAD INV] Sucesso na replicação para o Legal One.`);
                } else {
                     console.error(`[UPLOAD INV] Falha: Não foi possível ler o buffer do arquivo para replicação.`);
                }

            } else {
                console.warn(`[UPLOAD INV] Contato não encontrado no Legal One. Documento salvo apenas localmente.`);
            }

        } catch (error: any) {
            // Não bloqueamos o fluxo principal se o Legal One falhar, mas logamos o erro
            console.error(`[UPLOAD INV] Falha ao replicar no Legal One:`, error.message);
        }

        return fileUrl;
    }
}

export { UploadInvestmentDocumentUseCase };