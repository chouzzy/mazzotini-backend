import dotenv from 'dotenv';
// Carrega as variáveis de ambiente
dotenv.config();

import { PrismaClient } from "@prisma/client";
import axios from 'axios';

const prisma = new PrismaClient();

// Configurações do Auth0 (Lidas do .env)
const DOMAIN = process.env.AUTH0_MGMT_DOMAIN || process.env.AUTH0_DOMAIN;
const CLIENT_ID = process.env.AUTH0_MGMT_CLIENT_ID;
const CLIENT_SECRET = process.env.AUTH0_MGMT_CLIENT_SECRET;

// Função para pausar a execução (sleep)
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function getMgmtToken() {
    console.log("🔑 Obtendo Token de Gestão...");
    try {
        const response = await axios.post(`https://${DOMAIN}/oauth/token`, {
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            audience: `https://${DOMAIN}/api/v2/`,
            grant_type: "client_credentials"
        });
        return response.data.access_token;
    } catch (error: any) {
        console.error("❌ Erro ao pegar token:", error.response?.data || error.message);
        throw error;
    }
}

async function main() {
    console.log("🔄 Iniciando sincronização LENTA (Safe Mode)...");

    if (!DOMAIN || !CLIENT_ID || !CLIENT_SECRET) {
        throw new Error("❌ Variáveis de ambiente do Auth0 Mgmt não configuradas.");
    }

    const token = await getMgmtToken();
    
    // 1. Busca lista básica de usuários (Apenas 1 requisição)
    console.log("📡 Buscando lista de usuários...");
    let users = [];
    try {
        const response = await axios.get(`https://${DOMAIN}/api/v2/users`, {
            headers: { Authorization: `Bearer ${token}` },
            params: { per_page: 100 } // Tenta pegar o máximo possível em uma chamada
        });
        users = response.data;
    } catch (error: any) {
        console.error("❌ Erro ao listar usuários:", error.response?.data || error.message);
        return;
    }

    console.log(`✅ ${users.length} usuários encontrados. Iniciando atualização um por um...`);

    let updatedCount = 0;

    // 2. Loop LENTO: Busca roles um por um com pausa
    for (const user of users) {
        const userId = user.user_id;
        const userEmail = user.email;

        // Verifica se usuário existe no banco local antes de gastar cota da API
        const localUser = await prisma.user.findUnique({ where: { auth0UserId: userId } });
        if (!localUser) {
            console.log(`⏩ Ignorando ${userEmail} (não existe no banco local).`);
            continue;
        }

        try {
            // Busca roles deste usuário específico (Gasta 1 requisição)
            const rolesResponse = await axios.get(`https://${DOMAIN}/api/v2/users/${userId}/roles`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            const roles = rolesResponse.data;
            const primaryRole = roles.length > 0 ? roles[0].name : null;

            if (primaryRole) {
                await prisma.user.update({
                    where: { id: localUser.id },
                    data: { role: primaryRole }
                });
                console.log(`✅ [${updatedCount + 1}/${users.length}] Atualizado: ${userEmail} -> ${primaryRole}`);
                updatedCount++;
            } else {
                console.log(`🔸 [${updatedCount + 1}/${users.length}] Sem role: ${userEmail}`);
            }

            // =================================================================
            // O SEGREDO: Pausa de 500ms entre cada requisição
            // Isso garante que nunca passaremos de 2 req/s
            // =================================================================
            await wait(500); 

        } catch (error: any) {
            if (error.response?.status === 429) {
                console.warn(`⚠️ Rate Limit atingido em ${userEmail}. Pausando 10s...`);
                await wait(10000); // Se bater no limite, espera muito
            } else {
                console.error(`❌ Erro em ${userEmail}:`, error.message);
            }
        }
    }

    console.log(`\n🏁 Sincronização concluída!`);
    console.log(`📝 Total atualizados: ${updatedCount}`);
}

main()
    .catch(e => {
        console.error("\n❌ Erro no script:", e);
        process.exit(1);
    })
    .finally(async () => await prisma.$disconnect());