// /src/services/legalOneApiService.ts
import axios from 'axios';

// ============================================================================
//  INTERFACES DA RESPOSTA REAL (BASEADO NO SCHEMA)
// ============================================================================

export interface LegalOneParticipant {
    type: "Customer" | "PersonInCharge" | "OtherParty" | "Party" | "Other" | "LawyerOfOtherParty" | "Requester";
    contactId: number;
}

export interface LegalOneLawsuit {
    id: number;
    folder: string;
    title: string;
    identifierNumber: string;
    monetaryAmount?: { Value: number; Code: string };
    participants: LegalOneParticipant[];
    // ... outros campos
}

export interface LegalOneLawsuitApiResponse {
    value: LegalOneLawsuit[];
}

export interface LegalOneUpdate {
    id: number;
    description: string;
    notes: string | null;
    date: string;
    typeId: number;
    originType: 'Manual' | 'OfficialJournalsCrawler' | string;
}

export interface LegalOneUpdatesApiResponse {
    value: LegalOneUpdate[];
}

export interface LegalOneContact {
    id: number;
    name: string;
}

// NOVA INTERFACE para os Documentos
export interface LegalOneDocument {
    id: number;
    archive: string; // Nome do ficheiro
    type: string; // Categoria
}

export interface LegalOneDocumentsApiResponse {
    value: LegalOneDocument[];
}

// NOVA INTERFACE para o link de download
export interface LegalOneDocumentDownload {
    id: number;
    url: string;
}


// ============================================================================
//  LÓGICA DE SERVIÇO DA API
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
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        const requestUrl = `${apiRestUrl}/Lawsuits`;

        const response = await axios.get<LegalOneLawsuitApiResponse>(requestUrl, {
            headers: { 'Authorization': `Bearer ${token}` },
            params: {
                '$filter': `identifierNumber eq '${processNumber}'`,
                '$expand': 'participants'
            }
        });

        const results = response.data.value;
        if (!results || results.length === 0) {
            throw new Error(`Nenhum processo encontrado no Legal One com o número: ${processNumber}`);
        }

        return results[0];
    }

    public async getProcessUpdates(lawsuitId: number): Promise<LegalOneUpdate[]> {
        const token = await this.getAccessToken();
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        const requestUrl = `${apiRestUrl}/Updates`;

        console.log(`[Legal One API Service] Buscando andamentos para o Lawsuit ID: ${lawsuitId}`);

        const response = await axios.get<LegalOneUpdatesApiResponse>(requestUrl, {
            headers: { 'Authorization': `Bearer ${token}` },
            params: {
                '$filter': `relationships/any(r: r/linkType eq 'Litigation' and r/linkId eq ${lawsuitId})`,
                '$orderby': 'date desc'
            }
        });

        return response.data.value || [];
    }
    
    public async getContactDetails(contactId: number): Promise<LegalOneContact> {
        const token = await this.getAccessToken();
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        const requestUrl = `${apiRestUrl}/Contacts/${contactId}`;

        console.log(`[Legal One API Service] Buscando detalhes do contato ID: ${contactId}`);
        
        const response = await axios.get<LegalOneContact>(requestUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        return response.data;
    }

    // NOVA FUNÇÃO para buscar os documentos de um processo
    public async getProcessDocuments(lawsuitId: number): Promise<LegalOneDocument[]> {
        const token = await this.getAccessToken();
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        const requestUrl = `${apiRestUrl}/Documents`;

        console.log(`[Legal One API Service] Buscando documentos para o Lawsuit ID: ${lawsuitId}`);

        const response = await axios.get<LegalOneDocumentsApiResponse>(requestUrl, {
            headers: { 'Authorization': `Bearer ${token}` },
            params: {
                '$filter': `relationships/any(r: r/linkType eq 'Litigation' and r/linkId eq ${lawsuitId})`,
            }
        });

        return response.data.value || [];
    }

    // NOVA FUNÇÃO para obter a URL de download de um documento
    public async getDocumentDownloadUrl(documentId: number): Promise<string> {
        const token = await this.getAccessToken();
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        // Endpoint especial para gerar a URL de download
        const requestUrl = `${apiRestUrl}/Documents/UrlDownload(key=${documentId})`;

        console.log(`[Legal One API Service] Gerando URL de download para o Documento ID: ${documentId}`);

        const response = await axios.get<LegalOneDocumentDownload>(requestUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        return response.data.url;
    }
}

export const legalOneApiService = new LegalOneApiService();
