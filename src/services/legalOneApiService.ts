// /src/services/legalOneApiService.ts
import { User } from '@prisma/client';
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
    email?: string;
    documentNumber?: string;
}

interface LegalOneCreateContactPayload {
    name: string;
    email: string;
    documentNumber?: string;
    contactType: 'Person';
}

export interface LegalOneDocument {
    id: number;
    archive: string;
    type: string;
}

export interface LegalOneDocumentsApiResponse {
    value: LegalOneDocument[];
}

export interface LegalOneDocumentDownload {
    id: number;
    url: string;
}

// Interfaces para UploadFromUrl
interface RelationshipModel {
    link: 'Contact' | 'Litigation';
    linkItem: {
        id: number;
    };
}

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

// Interface para um Contato (genérico)
export interface LegalOneContact {
    id: number;
    name: string;
    email?: string;
    documentNumber?: string;
}
// Interface para o retorno de 'getcontainer'
interface LegalOneUploadContainer {
    id: number;
    fileName: string;
    externalId: string; // Esta é a URL para onde devemos enviar o PUT
    uploadedFileSize: number;
}

// Interface para o payload de 'POST /documents' (finalização)
interface LegalOneDocumentPayload {
    archive: string; // O nome do ficheiro (ex: "rg.pdf")
    typeId: string; // O tipo de documento (ex: "1-3")
    fileName: string; // O 'fileName' retornado pelo getcontainer
    relationships: {
        link: 'Contact';
        linkItem: { id: number };
    }[];
}

export interface LegalOneDocument {
    id: number;
    archive: string;
    type: string;
}
export interface LegalOneDocumentsApiResponse {
    value: LegalOneDocument[];
}
export interface LegalOneDocumentDownload {
    id: number;
    url: string;
}
interface RelationshipModel {
    link: 'Contact' | 'Litigation';
    linkItem: {
        id: number;
    };
}

// Interface para o payload de criação de /individuals (Pessoa)
interface LegalOneCreatePersonPayload {
    name: string;
    identificationNumber?: string; // CPF
    country?: { id: number }; 
    birthDate?: string;
    gender?: 'Male' | 'Female'; // CORRIGIDO: Removido 'Other'
    emails: { email: string; isMainEmail: boolean; typeId: number }[];
    phones?: { number: string; isMainPhone: boolean; typeId: number }[];
    addresses?: {
        type: 'Residential' | 'Comercial';
        addressLine1: string; // Rua
        addressNumber: string;
        addressLine2?: string; // Complemento
        neighborhood: string;
        cityId: number; // TODO: Precisamos de um "de-para" de Nome de Cidade para ID
        isMainAddress: boolean;
    }[];
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
                '$filter': `relationships/any(r: r/Link eq 'Litigation' and r/LinkItem/Id eq ${lawsuitId})`,
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

    /**
      * CORREÇÃO: Cria um novo Contato (Pessoa) usando o endpoint POST /individuals
      * e o payload completo do 'PersonModel'.
      */
    public async createContact(user: User): Promise<LegalOneContact> {
        const token = await this.getAccessToken();
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        const requestUrl = `${apiRestUrl}/individuals`; // Endpoint correto: /individuals

        console.log(`[Legal One API Service] A criar novo contato (Individual): ${user.name} (${user.email})`);

        // Mapeia os dados do nosso 'User' para o 'PersonModel' do Legal One
        const payload: LegalOneCreatePersonPayload = {
            name: user.name,
            identificationNumber: user.cpfOrCnpj || undefined,
            birthDate: user.birthDate ? new Date(user.birthDate).toISOString() : undefined,
            gender: 'Male', // TODO: Adicionar 'gender' ao nosso formulário
            country: {
                id: 1 // Assumimos 1 como o ID para "Brasil"
            },
            emails: [
                {
                    email: user.email,
                    isMainEmail: true,
                    typeId: 1 // Assumido 1 = 'Pessoal' (idealmente viria de GET /contactemailtypes)
                }
            ],
            phones: [],
            addresses: [],
        };

        // Adiciona o telemóvel se existir
        if (user.cellPhone) {
            payload.phones?.push({
                number: user.cellPhone,
                isMainPhone: true,
                typeId: 1 // Assumido 1 = 'Celular' (idealmente viria de GET /contactphonetypes)
            });
        }

        // Adiciona o endereço residencial se existir
        if (user.residentialCep && user.residentialStreet) {
            payload.addresses?.push({
                type: 'Residential',
                addressLine1: user.residentialStreet,
                addressNumber: user.residentialNumber || 'S/N',
                addressLine2: user.residentialComplement || undefined,
                neighborhood: user.residentialNeighborhood || 'N/A',
                cityId: 1, // TODO: Precisamos de um "de-para" de /cities (ex: 'São Paulo' -> 1)
                isMainAddress: user.correspondenceAddress === 'residential',
            });
        }

        // Adiciona o endereço comercial se existir
        if (user.commercialCep && user.commercialStreet) {
            payload.addresses?.push({
                type: 'Comercial',
                addressLine1: user.commercialStreet,
                addressNumber: user.commercialNumber || 'S/N',
                addressLine2: user.commercialComplement || undefined,
                neighborhood: user.commercialNeighborhood || 'N/A',
                cityId: 1, // TODO: Precisamos de um "de-para"
                isMainAddress: user.correspondenceAddress === 'commercial',
            });
        }

        try {
            const response = await axios.post<LegalOneContact>(requestUrl, payload, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            console.log(`[Legal One API Service] Resposta: ${response.data}`);
            console.log(`[Legal One API Service] Contato (Individual) criado com ID: ${response.data.id}`);
            return response.data;
        } catch (error:any) {
            console.error(`[Legal One API Service] Erro ao criar contato (Individual):`, error.response.data);
            throw new Error("Erro ao criar contato no Legal One."); 
        }

    }


    public async getProcessDocuments(lawsuitId: number): Promise<LegalOneDocument[]> {
        const token = await this.getAccessToken();
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        const requestUrl = `${apiRestUrl}/Documents`;

        console.log(`[Legal One API Service] Buscando documentos para o Lawsuit ID: ${lawsuitId}`);

        const response = await axios.get<LegalOneDocumentsApiResponse>(requestUrl, {
            headers: { 'Authorization': `Bearer ${token}` },
            params: {
                '$filter': `relationships/any(r: r/Link eq 'Litigation' and r/LinkItem/Id eq ${lawsuitId})`,
            }
        });

        return response.data.value || [];
    }

    public async getDocumentDownloadUrl(documentId: number): Promise<string> {
        const token = await this.getAccessToken();
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        const requestUrl = `${apiRestUrl}/Documents/UrlDownload(key=${documentId})`;

        console.log(`[Legal One API Service] Gerando URL de download para o Documento ID: ${documentId}`);

        const response = await axios.get<LegalOneDocumentDownload>(requestUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        return response.data.url;
    }

    /**
      * NOVO MÉTODO (Etapa 1 do Upload): Pede ao Legal One um "container" para o upload.
      */
    public async getUploadContainer(fileExtension: string): Promise<LegalOneUploadContainer> {
        const token = await this.getAccessToken();
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        const requestUrl = `${apiRestUrl}/documents/getcontainer(fileExtension='.${fileExtension}')`;

        console.log(`[Legal One API Service] A pedir container para um ficheiro .${fileExtension}`);

        const response = await axios.get<LegalOneUploadContainer>(requestUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        return response.data;
    }

    /**
     * NOVO MÉTODO (Etapa 2 do Upload): Envia o ficheiro para o Azure Storage do Legal One.
     */
    public async uploadFileToContainer(containerUrl: string, fileBuffer: Buffer, mimeType: string): Promise<void> {
        console.log(`[Legal One API Service] A fazer upload do ficheiro para o container do Azure...`);

        await axios.put(containerUrl, fileBuffer, {
            headers: {
                'x-ms-blob-type': 'BlockBlob',
                'Content-Type': mimeType,
            }
        });
        console.log(`[Legal One API Service] Upload para o container concluído.`);
    }

    /**
     * NOVO MÉTODO (Etapa 3 do Upload): Finaliza o documento e anexa-o a um Contato.
     */
    public async finalizeDocument(
        fileNameInContainer: string,
        originalFileName: string,
        contactId: number
    ): Promise<void> {
        const token = await this.getAccessToken();
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        const requestUrl = `${apiRestUrl}/Documents`;

        console.log(`[Legal One API Service] A finalizar e anexar o documento ${originalFileName} ao Contato ID: ${contactId}`);

        const payload: LegalOneDocumentPayload = {
            archive: originalFileName,
            typeId: "1-3", // Assumido "Documentos Gerais - Cópia" (idealmente buscar de GET /documenttypes)
            fileName: fileNameInContainer, // O 'fileName' retornado pelo 'getcontainer'
            relationships: [
                {
                    link: "Contact",
                    linkItem: { id: contactId }
                }
            ]
        };

        await axios.post(requestUrl, payload, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log(`[Legal One API Service] Documento ${originalFileName} anexado com sucesso.`);
    }
}

export const legalOneApiService = new LegalOneApiService();

