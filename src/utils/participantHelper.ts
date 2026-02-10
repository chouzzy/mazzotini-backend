import { PrismaClient, User } from "@prisma/client";
import { legalOneApiService } from "../services/legalOneApiService";
import { unmask } from "./masks"; 
import { LegalOneParticipant } from "../services/legalOneTypes";

const prisma = new PrismaClient();

/**
 * Processa a lista de participantes do Legal One, identifica os clientes ("Customer"),
 * busca o CPF/CNPJ na API se necessário, e cria/sincroniza o usuário no banco local.
 * * @returns Lista de Usuários (do nosso banco) correspondentes aos clientes do processo.
 */
export const syncParticipantsAsUsers = async (participants: LegalOneParticipant[]): Promise<User[]> => {
    if (!participants || participants.length === 0) return [];

    // 1. Filtra apenas Clientes (Credores)
    const customers = participants.filter(p => p.type === "Customer");
    
    const syncedUsers: User[] = [];

    console.log(`[PARTICIPANTS] Processando ${customers.length} clientes encontrados...`);

    for (const customer of customers) {
        try {
            if (!customer.contactId) continue;

            // -------------------------------------------------------------
            // A. Tenta encontrar no DB local pelo ID do Legal One (Mais rápido)
            // -------------------------------------------------------------
            let user = await prisma.user.findFirst({
                where: { legalOneContactId: customer.contactId }
            });

            if (user) {
                console.log(`[PARTICIPANTS] Usuário encontrado localmente por ID (${user.name}).`);
                syncedUsers.push(user);
                continue;
            }

            // -------------------------------------------------------------
            // B. Se não achou, vai ao Legal One buscar o CPF/CNPJ
            // -------------------------------------------------------------
            console.log(`[PARTICIPANTS] Usuário novo (ID ${customer.contactId}). Buscando detalhes na API...`);
            
            // Aqui usamos o seu endpoint genérico descoberto
            const legalOneContact = await legalOneApiService.getContactGeneric(customer.contactId);

            const cpfOrCnpjRaw = legalOneContact.identificationNumber ? unmask(legalOneContact.identificationNumber) : null;
            
            if (!cpfOrCnpjRaw) {
                 console.warn(`[PARTICIPANTS] Contato "${customer.contactName}" não possui CPF/CNPJ no Legal One. Pulando criação automática.`);
                 continue;
            }

            // -------------------------------------------------------------
            // C. Tenta encontrar no DB local pelo CPF/CNPJ (Evita duplicidade)
            // -------------------------------------------------------------
            user = await prisma.user.findFirst({
                where: { cpfOrCnpj: cpfOrCnpjRaw }
            });

            if (user) {
                // Existe pelo CPF mas não tinha o ID vinculado. Atualizamos.
                console.log(`[PARTICIPANTS] Usuário encontrado por CPF. Vinculando ID Legal One.`);
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: { legalOneContactId: customer.contactId }
                });
            } else {
                // -------------------------------------------------------------
                // D. Criar novo usuário "Shadow" (Sem Login Auth0 ainda)
                // -------------------------------------------------------------
                console.log(`[PARTICIPANTS] Criando novo usuário no sistema: ${legalOneContact.name}`);
                
                // Geramos um ID temporário para o Auth0UserId pois é campo único obrigatório.
                // Quando ele se cadastrar de verdade, o fluxo de "Approve" vai reconciliar pelo CPF.
                const tempAuth0Id = `legalone|import|${customer.contactId}`;

                user = await prisma.user.create({
                    data: {
                        name: legalOneContact.name,
                        email: legalOneContact.email || `pendente_${customer.contactId}@mazzotini.placeholder`, 
                        cpfOrCnpj: cpfOrCnpjRaw,
                        // Se for PF, tenta salvar RG
                        rg: legalOneContact.personStateIdentificationNumber ? unmask(legalOneContact.personStateIdentificationNumber) : null,
                        
                        auth0UserId: tempAuth0Id,
                        legalOneContactId: customer.contactId,
                        
                        status: 'ACTIVE', // Já vem "aprovado" pois é cliente oficial do Legal One
                        role: 'INVESTOR', // Assume papel de investidor
                    }
                });
            }

            syncedUsers.push(user);

        } catch (error: any) {
            console.error(`[PARTICIPANTS] Erro ao processar participante ${customer.contactName}:`, error.message);
        }
    }

    return syncedUsers;
};