import { prisma } from '../prisma';
import { legalOneApiService } from "../services/legalOneApiService";
import { unmask } from "./masks";
import { LegalOneParticipant } from "../services/legalOneTypes";


/**
 * Tipos de participante do Legal One que NÃO devem ser cadastrados como clientes.
 * - PersonInCharge   → Responsável (gestor interno do escritório)
 * - OtherParty       → Parte Contrária (adversária no processo)
 * - LawyerOfOtherParty → Advogado da parte contrária
 */
const EXCLUDED_PARTICIPANT_TYPES: LegalOneParticipant['type'][] = [
    'PersonInCharge',
    'OtherParty',
    'LawyerOfOtherParty',
];

/**
 * Sincroniza participantes do Legal One com a tabela User do nosso banco.
 * Se o usuário não existir, cria um "Shadow User" (Usuário Sombra).
 *
 * Regra: o shadow user é sempre criado se o participante tiver contactId.
 * CPF/CNPJ é opcional — preenchido quando disponível.
 */
export const syncParticipantsAsUsers = async (participants: LegalOneParticipant[]): Promise<User[]> => {
    if (!participants || participants.length === 0) return [];

    // Filtra tipos que não devem ser cadastrados como clientes (Responsável, Parte Contrária, Advogado)
    const filtered = participants.filter(p => !EXCLUDED_PARTICIPANT_TYPES.includes(p.type));
    if (filtered.length < participants.length) {
        console.log(`[PARTICIPANTS] Filtrados ${participants.length - filtered.length} participante(s) excluídos (Responsável/Parte Contrária/Advogado). Processando ${filtered.length}.`);
    }
    participants = filtered;

    const syncedUsers: User[] = [];

    console.log(`[PARTICIPANTS] Encontrados ${participants.length} participantes no processo. Processando...`);

    for (const customer of participants) {
        try {
            if (!customer.contactId) continue;

            // -------------------------------------------------------------
            // A. Tenta encontrar no DB local pelo ID do Legal One
            // -------------------------------------------------------------
            let user = await prisma.user.findFirst({
                where: { legalOneContactId: customer.contactId }
            });

            if (user) {
                // Se o encontrado for um shadow user, verifica se há um usuário real com mesmo CPF
                const isShadowUser = user.auth0UserId.startsWith('legalone|import|');
                if (isShadowUser && user.cpfOrCnpj) {
                    const realUser = await prisma.user.findFirst({
                        where: {
                            cpfOrCnpj: user.cpfOrCnpj,
                            NOT: { auth0UserId: { startsWith: 'legalone|import|' } }
                        }
                    });
                    if (realUser) {
                        console.log(`[PARTICIPANTS] Shadow user detectado para CPF ${user.cpfOrCnpj}. Preferindo usuário real: ${realUser.email}`);
                        if (!realUser.legalOneContactId) {
                            await prisma.user.update({
                                where: { id: realUser.id },
                                data: { legalOneContactId: customer.contactId }
                            });
                        }
                        syncedUsers.push(realUser);
                        continue;
                    }
                }
                console.log(`[PARTICIPANTS] Usuário já existe (ID LegalOne: ${customer.contactId}).`);
                syncedUsers.push(user);
                continue;
            }

            // -------------------------------------------------------------
            // B. Usuário não existe. Tenta buscar CPF/CNPJ no Legal One
            //    (opcional — o shadow user é criado mesmo sem CPF)
            // -------------------------------------------------------------
            console.log(`[PARTICIPANTS] Usuário novo (ID ${customer.contactId}). Buscando dados na API...`);

            let cpfOrCnpjRaw: string | null = null;
            let contactName = customer.contactName || `Contato ${customer.contactId}`;
            let contactEmail: string | null = null;
            let contactRg: string | null = null;

            try {
                const legalOneContact = await legalOneApiService.getContactGeneric(customer.contactId);
                contactName = legalOneContact.name || contactName;
                contactEmail = legalOneContact.email || null;
                cpfOrCnpjRaw = legalOneContact.identificationNumber
                    ? unmask(legalOneContact.identificationNumber)
                    : null;
                contactRg = legalOneContact.personStateIdentificationNumber
                    ? unmask(legalOneContact.personStateIdentificationNumber)
                    : null;
            } catch (contactErr: any) {
                // getContactGeneric falhou (ex: endpoint não disponível, 404, etc.)
                // Não bloqueia — criamos o shadow user com os dados disponíveis do participante
                console.warn(`[PARTICIPANTS] Não foi possível buscar detalhes do contato ${customer.contactId}: ${contactErr.message}. Criando shadow user com dados básicos.`);
            }

            // -------------------------------------------------------------
            // C. Se tiver CPF/CNPJ, verifica se já existe usuário com esse documento
            // -------------------------------------------------------------
            if (cpfOrCnpjRaw) {
                user = await prisma.user.findFirst({
                    where: { cpfOrCnpj: cpfOrCnpjRaw }
                });

                if (user) {
                    console.log(`[PARTICIPANTS] Usuário encontrado por CPF. Vinculando ID Legal One.`);
                    user = await prisma.user.update({
                        where: { id: user.id },
                        data: { legalOneContactId: customer.contactId }
                    });
                    syncedUsers.push(user);
                    continue;
                }
            }

            // -------------------------------------------------------------
            // D. CRIAR O "SHADOW USER"
            //    Sempre criado se tiver contactId (CPF é opcional aqui)
            // -------------------------------------------------------------
            console.log(`[PARTICIPANTS] Criando SHADOW USER para: ${contactName}`);

            const tempAuth0Id = `legalone|import|${customer.contactId}`;
            const placeholderEmail = contactEmail || `pendente_${customer.contactId}@mazzotini.placeholder`;

            // Verifica se já existe placeholder com esse email (concorrência)
            const existingByEmail = await prisma.user.findFirst({
                where: { email: placeholderEmail }
            });

            if (existingByEmail) {
                console.log(`[PARTICIPANTS] Shadow user com email placeholder já existe. Reutilizando.`);
                syncedUsers.push(existingByEmail);
                continue;
            }

            user = await prisma.user.create({
                data: {
                    name: contactName,
                    email: placeholderEmail,
                    cpfOrCnpj: cpfOrCnpjRaw || null,
                    rg: contactRg,
                    auth0UserId: tempAuth0Id,
                    legalOneContactId: customer.contactId,
                    status: 'ACTIVE',
                    role: 'INVESTOR',
                }
            });

            syncedUsers.push(user);

        } catch (error: any) {
            console.error(`[PARTICIPANTS] Erro ao processar ${customer.contactName}:`, error.message);
        }
    }

    console.log(`[PARTICIPANTS] Sincronização concluída. ${syncedUsers.length}/${participants.length} usuários processados.`);
    return syncedUsers;
};
