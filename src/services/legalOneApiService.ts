import axios from 'axios';

// ============================================================================
//  1. INTERFACES DA RESPOSTA REAL (BASEADO NO SCHEMA)
// ============================================================================
// Tipagem para um participante, como definido no schema
export interface LegalOneParticipant {
    type: "Customer" | "PersonInCharge" | "OtherParty" | "Party" | "Other" | "LawyerOfOtherParty" | "Requester";
    contactId: number;
    contact?: { // Supondo que podemos expandir o contato
        name: string;
    };
    // ... outros campos de participante
}

// Tipagem para o objeto Lawsuit, agora 100% alinhada com o schema
export interface LegalOneLawsuit {
    id: number;
    folder: string;
    title: string;
    identifierNumber: string; // Este é o nosso "processNumber"
    monetaryAmount?: { Value: number; Code: string };
    courtId?: number;
    justiceId?: number;
    participants: LegalOneParticipant[];
    // Adicione outros campos do schema que forem necessários
}

// A resposta da API é uma coleção
export interface LegalOneApiResponse {
    value: LegalOneLawsuit[];
}


// ============================================================================
//  2. LÓGICA DE SERVIÇO DA API (ATUALIZADA)
// ============================================================================
class LegalOneApiService {
    private accessToken: string | null = null;
    private tokenExpiresAt: number | null = null;

    private async getAccessToken(): Promise<string> {
        if (this.accessToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt) {
            return this.accessToken;
        }
        
        console.log("[Legal One API Service] Obtendo novo token de acesso...");

        const key = process.env.LEGAL_ONE_CONSUMER_KEY;
        const secret = process.env.LEGAL_ONE_CONSUMER_SECRET;
        const baseUrl = process.env.LEGAL_ONE_API_BASE_URL;

        if (!key || !secret || !baseUrl) {
            throw new Error("Credenciais ou URL Base da API do Legal One não configuradas.");
        }
        
        const tokenUrl = `${baseUrl}/oauth?grant_type=client_credentials`;

        const response = await axios.get(tokenUrl, {
            headers: { 'Authorization': `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}` }
        });

        const { access_token, expires_in } = response.data;
        
        this.accessToken = access_token;
        this.tokenExpiresAt = Date.now() + (expires_in - 60) * 1000;

        console.log("[Legal One API Service] Novo token obtido com sucesso.");
        return this.accessToken as string;
    }

    public async getProcessDetails(processNumber: string): Promise<LegalOneLawsuit> {
        const token = await this.getAccessToken();
        const apiBaseUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;

        console.log(`[Legal One API Service] Buscando dados para o processo: ${processNumber}`);
        
        const response = await axios.get<LegalOneApiResponse>(`${apiBaseUrl}/Lawsuits`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            params: {
                '$filter': `identifierNumber eq '${processNumber}'`,
                // Expandimos os participantes e o contato dentro deles para já termos o nome
                '$expand': 'participants'
            }
        });

        const results = response.data.value;
        if (!results || results.length === 0) {
            throw new Error(`Nenhum processo encontrado no Legal One com o número: ${processNumber}`);
        }

        return results[0];
    }
}

export const legalOneApiService = new LegalOneApiService();

