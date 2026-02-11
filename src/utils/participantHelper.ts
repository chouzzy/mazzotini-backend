import { PrismaClient, User } from "@prisma/client";
import { legalOneApiService } from "../services/legalOneApiService";
import { unmask } from "./masks"; 
import { LegalOneParticipant } from "../services/legalOneTypes";

const prisma = new PrismaClient();

/**
 * Sincroniza participantes do Legal One com a tabela User do nosso banco.
 * Se o usuário não existir, cria um "Shadow User" (Usuário Sombra).
 */
export const syncParticipantsAsUsers = async (participants: LegalOneParticipant[]): Promise<User[]> => {
    if (!participants || participants.length === 0) return [];

    // 1. Filtra apenas quem é "Customer" (Cliente)
    const customers = participants.filter(p => p.type === "Customer");
    
    const syncedUsers: User[] = [];

    console.log(`[PARTICIPANTS] Encontrados ${customers.length} clientes no processo. Processando...`);

    for (const customer of customers) {
        try {
            if (!customer.contactId) continue;

            // -------------------------------------------------------------
            // A. Tenta encontrar no DB local pelo ID do Legal One
            // -------------------------------------------------------------
            let user = await prisma.user.findFirst({
                where: { legalOneContactId: customer.contactId }
            });

            if (user) {
                console.log(`[PARTICIPANTS] Usuário já existe (ID LegalOne: ${customer.contactId}).`);
                syncedUsers.push(user);
                continue;
            }

            // -------------------------------------------------------------
            // B. Se não achou, vai ao Legal One buscar o CPF/CNPJ
            // -------------------------------------------------------------
            console.log(`[PARTICIPANTS] Usuário novo (ID ${customer.contactId}). Buscando CPF na API...`);
            
            // Requer que você tenha implementado o getContactGeneric no passo anterior
            const legalOneContact = await legalOneApiService.getContactGeneric(customer.contactId);

            const cpfOrCnpjRaw = legalOneContact.identificationNumber ? unmask(legalOneContact.identificationNumber) : null;
            
            if (!cpfOrCnpjRaw) {
                 console.warn(`[PARTICIPANTS] Contato "${customer.contactName}" sem CPF/CNPJ. Pulando.`);
                 continue;
            }

            // -------------------------------------------------------------
            // C. Tenta encontrar no DB local pelo CPF/CNPJ (Para evitar duplicidade)
            // -------------------------------------------------------------
            user = await prisma.user.findFirst({
                where: { cpfOrCnpj: cpfOrCnpjRaw }
            });

            if (user) {
                // Achamos pelo CPF! Vamos apenas atualizar o ID do Legal One nele.
                console.log(`[PARTICIPANTS] Usuário encontrado por CPF. Vinculando ID Legal One.`);
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: { legalOneContactId: customer.contactId }
                });
            } else {
                // -------------------------------------------------------------
                // D. CRIAR O "SHADOW USER" (AQUI ESTÁ A MÁGICA)
                // -------------------------------------------------------------
                console.log(`[PARTICIPANTS] Criando SHADOW USER para: ${legalOneContact.name}`);
                
                // Criamos um ID fake para satisfazer o campo único do Prisma
                // Quando ele logar de verdade, o '/api/users/sync' vai substituir isso.
                const tempAuth0Id = `legalone|import|${customer.contactId}`;

                user = await prisma.user.create({
                    data: {
                        name: legalOneContact.name,
                        // Email é obrigatório? Se não tiver no Legal One, criamos um placeholder
                        email: legalOneContact.email || `pendente_${customer.contactId}@mazzotini.placeholder`, 
                        cpfOrCnpj: cpfOrCnpjRaw,
                        // Se for PF, tenta salvar RG
                        rg: legalOneContact.personStateIdentificationNumber ? unmask(legalOneContact.personStateIdentificationNumber) : null,
                        
                        auth0UserId: tempAuth0Id, // <--- O ID TEMPORÁRIO
                        legalOneContactId: customer.contactId,
                        
                        status: 'ACTIVE', // Já consideramos ativo pois é cliente oficial
                        role: 'INVESTOR', 
                    }
                });
            }

            syncedUsers.push(user);

        } catch (error: any) {
            console.error(`[PARTICIPANTS] Erro ao processar ${customer.contactName}:`, error.message);
        }
    }

    return syncedUsers;
};