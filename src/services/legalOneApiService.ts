// /src/services/legalOneApiService.ts
import { User } from '@prisma/client';
import axios, { AxiosResponse } from 'axios';

// ============================================================================
//  INTERFACES DA RESPOSTA REAL (BASEADO NO SCHEMA)
// ============================================================================

export interface LegalOneParticipant {
    type: "Customer" | "PersonInCharge" | "OtherParty" | "Party" | "Other" | "LawyerOfOtherParty" | "Requester";
    contactId: number;
}

export interface LegalOneLawsuit {
    id: number;
    originOfficeId?: number;
    natureId?: number;
    phaseId?: number | null;
    personIds?: number[];
    monetaryAmountType?: 'Determined' | 'Undetermined' | string;
    folder: string;
    title: string;
    type?: string;
    identifierNumber: string;
    oldNumber?: string | null;
    otherNumberTypeId?: number | null;
    otherNumber?: string | null;
    statusId?: number;
    distributionDate?: string | null;
    terminationDate?: string | null;
    closingDate?: string | null;
    closingReason?: string | null;
    closed?: boolean;
    responsibleOfficeId?: number | null;
    actionTypeId?: number | null;
    countryId?: number | null;
    stateId?: number | null;
    cityId?: number | null;
    courtId?: number | null;
    justiceId?: number | null;
    levelId?: number | null;
    jurisdictionId?: number | null;
    jurisdictionComplementId?: number | null;
    costsType?: string | null;
    notes?: string | null;
    creationDate?: string | null;
    changeJustification?: string | null;
    courtPanelNumber?: number | null;
    courtPanelNumberText?: string | null;
    contingency?: any | null;
    probabilityType?: any | null;
    resultDate?: string | null;
    decisionDate?: string | null;
    monetaryAmount?: {
        value: number;
        code: string | null;
    } | null;
    amountOfSettlementOrJudgment?: number | null;
    amountOfLawyersFee?: number | null;
    involvedAmount?: number | null;
    costs?: number | null;
    procedure?: {
        id: number;
        description: string;
    } | null;
    courtPanel?: {
        id: number;
        description: string;
    } | null;
    probability?: any | null;
    risk?: any | null;
    resultType?: any | null;
    result?: any | null;
    resultReason?: any | null;
    participants: (LegalOneParticipant & {
        id?: number;
        contactId?: number;
        contactName?: string;
        positionId?: number | null;
        isMainParticipant?: boolean;
    })[];
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

export interface LegalOneAppeal {
    id: number;
    folder: string;
    title: string;
    identifierNumber: string;
    participants: LegalOneParticipant[]; // <-- Importante, já temos essa interface
    courtPanel?: {
        id: number;
        description: string;
    };
    courtPanelNumberText?: string;
    relatedLitigationType?: 'Lawsuit' | string;
    relatedLitigationId?: number;
    // ... (outros campos do Appeal que não usamos agora)
}

export interface LegalOneAppealApiResponse {
    value: LegalOneAppeal[];
}

export interface LegalOneParticipant {
    type: "Customer" | "PersonInCharge" | "OtherParty" | "Party" | "Other" | "LawyerOfOtherParty" | "Requester";
    contactId: number;
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

export interface LegalOneProceduralIssue {
    id: number;
    title: string;
    identifierNumber: string;
    participants: any[]; // Usando 'any' para simplicidade, já que só queremos 'contactName'
    courtPanel?: { id: number; description: string };
    courtPanelNumberText?: string;
    relatedLitigationId?: number;
    relatedLitigationType?: 'Lawsuit' | string;
    // ... outros campos do JSON de resposta
}

export interface LegalOneProceduralIssueApiResponse {
    value: LegalOneProceduralIssue[];
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
    fileName: string; // O 'fileName' retornado pelo getcontainer
    repository: string; // Ex: "LegalOne"
    description: string; // Descrição do documento
    generateUrlDownload: string; // Ex: ""  
    typeId: string | null;
    author: string | null;
    type: string; // Ex: "#SM Documento Pessoal"
    isPhysicallyStored: boolean | null;
    isModel: boolean | null;
    fileUploader: string | null;
    beginDate: string | null;
    endDate: string | null;
    notes: string | null;
    phisicalLocalization: string | null;

    relationships: {
        link: 'Contact';
        linkItem: { id: number; description: string };
    }[];
}

export interface LegalOneDocument { id: number; archive: string; type: string; }
export interface LegalOneDocumentsApiResponse { value: LegalOneDocument[]; }
export interface LegalOneDocumentDownload { id: number; url: string; }
export interface LegalOneLawsuit { id: number; folder: string; title: string; identifierNumber: string; }
export interface LegalOneLawsuitApiResponse { value: LegalOneLawsuit[]; }
export interface LegalOneUpdate { id: number; description: string; notes: string | null; date: string; typeId: number; originType: string; }
export interface LegalOneUpdatesApiResponse {
    value: LegalOneUpdate[];
    '@odata.nextLink'?: string;
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

interface LegalOneState {
    id: number;
    name: string;
    stateCode: string;
}
interface LegalOneStateApiResponse {
    value: LegalOneState[];
}

interface LegalOneCountry {
    id: number;
    name: string;
}
interface LegalOneCountryApiResponse {
    '@odata.nextLink'?: string;
    value: LegalOneCountry[];
}
interface LegalOneCity {
    id: number;
    name: string;
    state: {
        id: number;
        name: string;
        country: {
            id: number;
            name: string;
        };
        stateCode: string; // "SP", "RJ", etc.
    };
}
interface LegalOneCityApiResponse {
    '@odata.nextLink'?: string;
    value: LegalOneCity[];
}

// Interface para o payload de criação de /individuals (Pessoa)
interface LegalOneCreatePersonPayload {
    name: string;
    personStateIdentificationNumber?: string; // RG
    country?: { id: number };
    birthDate?: string;
    gender?: 'Male' | 'Female'; // CORRIGIDO: Removido 'Other'
    emails: { email: string; isMainEmail: boolean; typeId: number; isBillingEmail: boolean; isInvoicingEmail: boolean }[];
    phones?: { number: string; isMainPhone: boolean; typeId: number }[];
    addresses?: {
        type: 'Residential' | 'Comercial';
        addressLine1: string; // Rua
        addressNumber: string;
        addressLine2?: string; // Complemento
        neighborhood: string;
        cityId: number; // TODO: Precisamos de um "de-para" de Nome de Cidade para ID
        isMainAddress: boolean;
        isBillingAddress: boolean;
        isInvoicingAddress: boolean;
    }[];
}

// ============================================================================
//  LÓGICA DE SERVIÇO DA API
// ============================================================================
class LegalOneApiService {
    private accessToken: string | null = null;
    private tokenExpiresAt: number | null = null;


    // --- NOVO: Caching para Lookups ---
    // Chave: "NOME DA CIDADE-UF" (ex: "SÃO PAULO-SP"), Valor: ID
    private cityMap = new Map<string, number>();
    // Chave: "NOME DO PAÍS" (ex: "BRASIL"), Valor: ID
    private countryMap = new Map<string, number>();

    private isCacheInitialized = false;
    private isCacheInitializing = false; // Mutex simples para evitar corridas

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


    // --- NOVOS MÉTODOS DE LOOKUP (SOB-DEMANDA) ---

    /**
     * Busca o ID de um país pelo nome (ex: "Brasil").
     * API: GET /countries?$filter=name eq 'Brasil'
     */
    private async getCountryIdByName(name: string): Promise<number | null> {
        console.log(`[Legal One Lookup] Buscando ID para o País: "${name}"`);
        const token = await this.getAccessToken();
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        const requestUrl = `${apiRestUrl}/countries`;

        try {
            const response = await axios.get<LegalOneCountryApiResponse>(requestUrl, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: {
                    '$filter': `name eq '${name}'`
                }
            });
            const country = response.data.value?.[0];
            return country ? country.id : null;
        } catch (error: any) {
            console.error(`[Legal One Lookup] Erro ao buscar País "${name}":`, error.message);
            return null;
        }
    }

    /**
    * Busca o ID de um estado pela sigla/UF (ex: "SP").
    * API: GET /states?$filter=stateCode eq 'SP'
    */
    private async getStateIdByCode(stateCode: string): Promise<number | null> {
        console.log(`[Legal One Lookup] Buscando ID para o Estado (UF): "${stateCode}"`);
        const token = await this.getAccessToken();
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        const requestUrl = `${apiRestUrl}/states`;

        try {
            const response = await axios.get<LegalOneStateApiResponse>(requestUrl, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: {
                    '$filter': `stateCode eq '${stateCode}'`
                }
            });
            const state = response.data.value?.[0];
            return state ? state.id : null;
        } catch (error: any) {
            console.error(`[Legal One Lookup] Erro ao buscar Estado "${stateCode}":`, error.message);
            return null;
        }
    }

    /**
     * Busca o ID de uma cidade pelo nome E ID do estado.
     * API: GET /cities?$filter=name eq 'São Paulo' and state/id eq 1
     */
    private async getCityIdByNameAndState(cityName: string, stateId: number): Promise<number | null> {
        console.log(`[Legal One Lookup] Buscando ID para Cidade: "${cityName}" no Estado ID: ${stateId}`);
        const token = await this.getAccessToken();
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        const requestUrl = `${apiRestUrl}/cities`;

        try {
            const response = await axios.get<LegalOneCityApiResponse>(requestUrl, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: {
                    '$filter': `name eq '${cityName}' and state/id eq ${stateId}`
                }
            });
            const city = response.data.value?.[0];
            return city ? city.id : null;
        } catch (error: any) {
            console.error(`[Legal One Lookup] Erro ao buscar Cidade "${cityName}":`, error.message);
            return null;
        }
    }



    /**
     * Inicializa os mapas de Cidades e Países na memória.
     * Será chamado automaticamente na primeira vez que um ID for solicitado.
     */
    private async initializeLookups(): Promise<void> {
        if (this.isCacheInitialized || this.isCacheInitializing) {
            // Se já estiver inicializado, retorna.
            // Se estiver inicializando em outra chamada, espera um pouco.
            if (this.isCacheInitializing) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                return;
            }
            if (this.isCacheInitialized) return;
        }
        this.isCacheInitializing = true;

        try {
            console.log("[Legal One Lookup] Inicializando cache de lookups (Países e Cidades)...");
            await this.fetchCountries();
            await this.fetchCities();
            this.isCacheInitialized = true;
            console.log(`[Legal One Lookup] Cache inicializado: ${this.countryMap.size} países, ${this.cityMap.size} cidades.`);
        } catch (error: any) {
            console.error("[Legal One Lookup] Falha ao inicializar o cache de lookups:", error.message);
            // Permite tentar novamente na próxima chamada
        } finally {
            this.isCacheInitializing = false;
        }
    }

    /**
     * Busca todos os países (com paginação) e os armazena no `countryMap`.
     */
    private async fetchCountries(): Promise<void> {
        const token = await this.getAccessToken();
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        let requestUrl: string | undefined = `${apiRestUrl}/countries`;

        console.log("[Legal One Lookup] Buscando países...");

        while (requestUrl) {
            const response: AxiosResponse<LegalOneCountryApiResponse> = await axios.get<LegalOneCountryApiResponse>(requestUrl, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            response.data.value.forEach(country => {
                this.countryMap.set(country.name.toUpperCase(), country.id);
            });

            requestUrl = response.data['@odata.nextLink'];
        }
    }

    /**
     * Busca todas as cidades (com paginação) e as armazena no `cityMap`.
     */
    private async fetchCities(): Promise<void> {
        const token = await this.getAccessToken();
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        // Usamos $expand para pegar o 'stateCode' (UF) na mesma chamada
        let requestUrl: string | undefined = `${apiRestUrl}/cities?$expand=state`;

        console.log("[Legal One Lookup] Buscando cidades (isso pode levar um tempo)...");

        while (requestUrl) {
            const response: AxiosResponse<LegalOneCityApiResponse> = await axios.get<LegalOneCityApiResponse>(requestUrl, {
                headers: { 'Authorization': `Bearer ${token}` }
            });


            response.data.value.forEach(city => {
                if (city.state && city.state.stateCode) {
                    // Chave composta: "SÃO PAULO-SP"
                    const key = `${city.name.toUpperCase()}-${city.state.stateCode.toUpperCase()}`;
                    this.cityMap.set(key, city.id);
                }
            });

            requestUrl = response.data['@odata.nextLink'];
            if (requestUrl) {
                console.log("[Legal One Lookup] Buscando próxima página de cidades...");
            }
        }
    }

    /**
     * Busca o ID de um país pelo nome (ex: "Brasil").
     */
    public async getCountryId(name: string): Promise<number | undefined> {
        if (!this.isCacheInitialized) {
            await this.initializeLookups(); // Garante que o cache esteja pronto
        }
        return this.countryMap.get(name.toUpperCase());
    }

    /**
     * Busca o ID de uma cidade pelo nome e UF (ex: "São Paulo", "SP").
     */
    public async getCityId(name: string, stateCode: string): Promise<number | undefined> {
        if (!this.isCacheInitialized) {
            await this.initializeLookups(); // Garante que o cache esteja pronto
        }
        const key = `${name.toUpperCase()}-${stateCode.toUpperCase()}`;
        return this.cityMap.get(key);
    }

    /**
 * NOVO MÉTODO: Busca na gaveta de "Recursos" (Appeals)
 * Usa a mesma lógica de "Busca Dupla" (com e sem pontuação).
 */
    public async getAppealDetails(processNumber: string): Promise<LegalOneAppeal> {
        const token = await this.getAccessToken();
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        const requestUrl = `${apiRestUrl}/appeals`; // <-- O endpoint que você descobriu!

        const cleanProcessNumber = processNumber.trim();

        // TENTATIVA ÚNICA: Buscar com a pontuação original
        try {
            console.log(`[Legal One API Service] Buscando (Appeal) com pontuação (${cleanProcessNumber})`);
            const response = await axios.get<LegalOneAppealApiResponse>(requestUrl, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: {
                    '$filter': `identifierNumber eq '${cleanProcessNumber}'`,
                    '$expand': 'participants'
                }
            });

            const results = response.data.value;
            if (results && results.length > 0) {
                console.log(`[Legal One API Service] (Appeal) Sucesso.`);
                return results[0];
            }
        } catch (error: any) {
            console.warn(`[Legal One API Service] (Appeal) Falha: ${error.message}`);
            // Lança o erro final
            throw new Error(`Nenhum Processo ou Recurso encontrado: ${cleanProcessNumber}`);
        }

        console.log(`[Legal One API Service] (Appeal) Não encontrado (array vazio).`);
        throw new Error(`Nenhum Processo ou Recurso encontrado: ${cleanProcessNumber}`);
    }

    /**
     * NOVO MÉTODO: Busca na gaveta de "Incidentes" (ProceduralIssues)
     */
    public async getProceduralIssueDetails(processNumber: string): Promise<LegalOneProceduralIssue> {
        const token = await this.getAccessToken();
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        const requestUrl = `${apiRestUrl}/ProceduralIssues`; // <-- A terceira gaveta!

        const cleanProcessNumber = processNumber.trim();

        try {
            console.log(`[Legal One API Service] Buscando (ProceduralIssue) com pontuação (${cleanProcessNumber})`);
            const response = await axios.get<LegalOneProceduralIssueApiResponse>(requestUrl, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: {
                    '$filter': `identifierNumber eq '${cleanProcessNumber}'`,
                    '$expand': 'participants'
                }
            });

            const results = response.data.value;
            if (results && results.length > 0) {
                console.log(`[Legal One API Service] (ProceduralIssue) Sucesso.`);
                return results[0];
            }
        } catch (error: any) {
            console.warn(`[Legal One API Service] (ProceduralIssue) Falha: ${error.message}`);
            // Lança o erro final
            throw new Error(`Nenhum Processo, Recurso ou Incidente encontrado: ${cleanProcessNumber}`);
        }

        console.log(`[Legal One API Service] (ProceduralIssue) Não encontrado (array vazio).`);
        throw new Error(`Nenhum Processo, Recurso ou Incidente encontrado: ${cleanProcessNumber}`);
    }

    public async getProcessDetails(processNumber: string): Promise<LegalOneLawsuit> {
        const token = await this.getAccessToken();
        console.log('Token obtido para busca de processo.', token);
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        const requestUrl = `${apiRestUrl}/Lawsuits`;

        // Limpa a string de "lixo" (espaços)
        const cleanProcessNumber = processNumber.trim();

        // TENTATIVA 1: Buscar com a pontuação original (em AMBOS os campos)
        try {
            console.log(`[Legal One API Service] Tentativa 1 (Busca Ampla): Buscando com pontuação (${cleanProcessNumber})`);

            // A NOVA LÓGICA: $filter=identifierNumber eq '...' or otherNumber eq '...'
            const filterQueryV1 = `identifierNumber eq '${cleanProcessNumber}' or otherNumber eq '${cleanProcessNumber}'`;

            const response = await axios.get<LegalOneLawsuitApiResponse>(requestUrl, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: {
                    '$filter': filterQueryV1,
                    '$expand': 'participants'
                }
            });

            const results = response.data.value;
            if (results && results.length > 0) {
                console.log(`[Legal One API Service] Tentativa 1 (Busca Ampla): Sucesso.`);
                return results[0]; // Encontrado! Retorna.
            }
        } catch (error: any) {
            console.warn(`[Legal One API Service] Tentativa 1 (Busca Ampla) falhou: ${error.message}`);
            // Continua para a Tentativa 2
        }
        // Se ambas as tentativas não retornarem nada
        console.log(`[Legal One API Service] Ambas as tentativas (Busca Ampla) falharam.`);
        throw new Error(`Nenhum processo encontrado no Legal One com o número: ${cleanProcessNumber}`);
    }

    public async getProcessUpdates(entityId: number): Promise<LegalOneUpdate[]> {
        const token = await this.getAccessToken();
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;

        // Array para acumular todos os andamentos de todas as páginas
        let allUpdates: LegalOneUpdate[] = [];

        // 1. O FILTRO CORRETO (Sua descoberta + Sugestão de eficiência)
        // Filtra pela entidade E pelo tipo 'Manual'
        const filterQuery = `relationships/any(r: r/linkType eq 'Litigation' and r/linkId eq ${entityId}) and originType eq 'Manual'`;

        // 2. MONTA A URL INICIAL
        // Usamos encodeURIComponent para garantir que o OData não quebre
        let requestUrl: string | null = `${apiRestUrl}/Updates?$filter=${encodeURIComponent(filterQuery)}&$orderby=date desc`;

        console.log(`[Legal One API Service] Buscando TODOS andamentos manuais para o Entity ID: ${entityId}`);

        try {
            // 3. O LOOP DE PAGINAÇÃO
            while (requestUrl) {
                const response: AxiosResponse<LegalOneUpdatesApiResponse> = await axios.get<LegalOneUpdatesApiResponse>(requestUrl, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                const updatesOnThisPage = response.data.value;

                if (updatesOnThisPage && updatesOnThisPage.length > 0) {
                    allUpdates = allUpdates.concat(updatesOnThisPage);
                }

                // 4. VERIFICA A PRÓXIMA PÁGINA
                // A API nos diz qual é a URL da próxima página
                requestUrl = response.data['@odata.nextLink'] || null;

                if (requestUrl) {
                    console.log(`[Legal One API Service] Próxima página encontrada (${allUpdates.length} já carregados), buscando...`);
                }
            }

            console.log(`[Legal One API Service] Busca concluída. Total de ${allUpdates.length} andamentos manuais encontrados para o Entity ID: ${entityId}.`);
            return allUpdates;

        } catch (error: any) {
            console.error(`[Legal One API Service] Erro ao buscar andamentos paginados para ${entityId}. Filtro: ${filterQuery}`);
            if (error.response && error.response.data) {
                console.error("[Legal One API Service] Erro detalhado:", JSON.stringify(error.response.data, null, 2));
            }
            throw error;
        }
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

    public async createContact(user: User): Promise<LegalOneContact> {
        const token = await this.getAccessToken();
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        const requestUrl = `${apiRestUrl}/individuals`;

        console.log(`[Legal One API Service] A criar novo contato (Individual): ${user.name} (${user.email})`);

        // --- LÓGICA DE LOOKUP ATIVADA ---
        const DEFAULT_COUNTRY_ID = 1; // ID 1 (Brasil)
        const DEFAULT_CITY_ID = 1; // ID 1 (Default/Não Encontrada)

        // 1. Busca ID do País (Default: 1 para "Brasil" se não achar)
        const countryName = (user.nationality === "Brasileira" || !user.nationality) ? "Brasil" : user.nationality;
        let countryId = await this.getCountryIdByName(countryName);
        if (!countryId) {
            console.warn(`[Legal One Lookup] Nacionalidade "${countryName}" não encontrada. Usando ID ${DEFAULT_COUNTRY_ID} (Brasil) como padrão.`);
            countryId = DEFAULT_COUNTRY_ID;
        }

        // 2. Busca ID do Estado e Cidade Residenciais
        let residentialCityId = DEFAULT_CITY_ID;
        if (user.residentialCity && user.residentialState) {
            const stateId = await this.getStateIdByCode(user.residentialState);
            if (stateId) {
                const cityId = await this.getCityIdByNameAndState(user.residentialCity, stateId);
                if (cityId) {
                    residentialCityId = cityId;
                } else {
                    console.warn(`[Legal One Lookup] Cidade Residencial "${user.residentialCity}" não encontrada no estado ${user.residentialState}. Usando ID ${DEFAULT_CITY_ID} como padrão.`);
                }
            } else {
                console.warn(`[Legal One Lookup] Estado Residencial "${user.residentialState}" não encontrado. Usando ID ${DEFAULT_CITY_ID} como padrão para a cidade.`);
            }
        }

        // 3. Busca ID do Estado e Cidade Comerciais (se aplicável)
        let commercialCityId = DEFAULT_CITY_ID;
        if (user.commercialCity && user.commercialState) {
            const stateId = await this.getStateIdByCode(user.commercialState);
            if (stateId) {
                const cityId = await this.getCityIdByNameAndState(user.commercialCity, stateId);
                if (cityId) {
                    commercialCityId = cityId;
                } else {
                    console.warn(`[Legal One Lookup] Cidade Comercial "${user.commercialCity}" não encontrada no estado ${user.commercialState}. Usando ID ${DEFAULT_CITY_ID} como padrão.`);
                }
            } else {
                console.warn(`[Legal One Lookup] Estado Comercial "${user.commercialState}" não encontrado. Usando ID ${DEFAULT_CITY_ID} como padrão para a cidade.`);
            }
        }
        // --- FIM DA LÓGICA DE LOOKUP ---


        // Mapeia os dados do nosso 'User' para o 'PersonModel' do Legal One
        const payload: LegalOneCreatePersonPayload = {
            name: user.name,
            personStateIdentificationNumber: user.rg || undefined,
            birthDate: user.birthDate ? new Date(user.birthDate).toISOString() : undefined,
            gender: user.gender as 'Male' | 'Female',
            country: {
                id: countryId
            },
            emails: [
                {
                    email: user.email,
                    isMainEmail: true,
                    isBillingEmail: true,
                    isInvoicingEmail: true,
                    typeId: 1 // TODO: Mapear tipo (ex: Pessoal)
                }
            ],
            phones: [],
            addresses: [],
        };

        // (Lógica de emails secundários e telefones inalterada)
        if (user.infoEmail) {
            payload.emails.push({
                email: user.infoEmail,
                isMainEmail: false,
                isBillingEmail: false,
                isInvoicingEmail: false,
                typeId: 2 // Assumido 2 = 'Trabalho'
            });
        }
        if (user.cellPhone) {
            payload.phones?.push({
                number: user.cellPhone,
                isMainPhone: true,
                typeId: 1 // Assumido 1 = 'Celular'
            });
        }
        if (user.phone) {
            payload.phones?.push({
                number: user.phone,
                isMainPhone: false,
                typeId: 2 // Assumido 2 = 'Fixo'
            });
        }


        // Adiciona o endereço residencial (agora com cityId dinâmico)
        if (user.residentialCep && user.residentialStreet) {
            payload.addresses?.push({
                type: 'Residential',
                addressLine1: user.residentialStreet,
                addressNumber: user.residentialNumber || 'S/N',
                addressLine2: user.residentialComplement || undefined,
                neighborhood: user.residentialNeighborhood || 'N/A',
                cityId: residentialCityId, // Mapeado (não mais fixo)
                isMainAddress: user.correspondenceAddress === 'residential',
                isBillingAddress: (user.commercialCep && user.commercialStreet) ? false : true,
                isInvoicingAddress: (user.commercialCep && user.commercialStreet) ? false : true,
            });
        }

        // Adiciona o endereço comercial (agora com cityId dinâmico)
        if (user.commercialCep && user.commercialStreet) {
            payload.addresses?.push({
                type: 'Comercial',
                addressLine1: user.commercialStreet,
                addressNumber: user.commercialNumber || 'S/N',
                addressLine2: user.commercialComplement || undefined,
                neighborhood: user.commercialNeighborhood || 'N/A',
                cityId: commercialCityId, // Mapeado (não mais fixo)
                isMainAddress: user.correspondenceAddress === 'commercial',
                isBillingAddress: true,
                isInvoicingAddress: true,
            });
        }

        try {
            console.log(`[Legal One API Service] Payload para criação do contato: ${JSON.stringify(payload, null, 2)}`);
            const response = await axios.post<LegalOneContact>(requestUrl, payload, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            console.log(`[Legal One API Service] Resposta:`, response.data);
            return response.data;
        } catch (error: any) {
            // Log detalhado do erro da API
            if (error.response && error.response.data) {
                console.log('[Legal One API Service] Erro detalhado:', JSON.stringify(error.response.data, null, 2));
            } else {
                console.log('[Legal One API Service] Erro:', error.message);
            }
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

    // ============================================================================
    //  FLUXO DE UPLOAD DE DOCUMENTOS (Etapas 1, 2, 3)
    // ============================================================================

    /**
     * Etapa 1 do Upload: Pede ao Legal One um "container" para o upload.
     */
    public async getUploadContainer(fileExtension: string): Promise<LegalOneUploadContainer> {
        const token = await this.getAccessToken();
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;

        // **CORREÇÃO (404):** A API espera aspas simples, ex: fileExtension='pdf'
        const requestUrl = `${apiRestUrl}/documents/getcontainer(fileExtension='${fileExtension}')`;

        console.log(`[Legal One API Service] A pedir container para um ficheiro '${fileExtension}'`);

        const response = await axios.get<LegalOneUploadContainer>(requestUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        return response.data;
    }

    /**
     * Etapa 2 do Upload: Envia o ficheiro para o Azure Storage do Legal One.
     */
    public async uploadFileToContainer(containerUrl: string, fileBuffer: Buffer, mimeType: string): Promise<void> {
        console.log(`[Legal One API Service] A fazer upload do ficheiro para o container do Azure...`);

        const response = await axios.put(containerUrl, fileBuffer, {
            headers: {
                'x-ms-blob-type': 'BlockBlob',
                'Content-Type': mimeType,
            }
        });

        console.log(`[Legal One API Service] data do upload:`, response.data);
        console.log(`[Legal One API Service] Resposta do upload: ${response.status} ${response.statusText}`);
        console.log(`[Legal One API Service] Upload para o container concluído.`);
    }

    /**
     * Etapa 3 do Upload: Finaliza o documento e anexa-o a um Contato.
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
            description: `#SM ${originalFileName}`,
            generateUrlDownload: '',
            typeId: null,
            type: 'Documento / Guia',
            repository: "LegalOne",
            notes: null,
            phisicalLocalization: null,
            author: null,
            beginDate: null,
            endDate: null,
            fileUploader: null,
            fileName: fileNameInContainer,
            isPhysicallyStored: false,
            isModel: false,
            relationships: [
                {
                    link: 'Contact',
                    linkItem: { id: contactId, description: originalFileName }
                }
            ]
        };

        console.log("[Legal One API Service] Payload de finalização:", JSON.stringify(payload, null, 2));

        try {
            await axios.post(requestUrl, payload, {
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
            });
            console.log(`[Legal One API Service] Documento ${originalFileName} anexado com sucesso.`);

        } catch (error: any) {
            // Log de erro aprimorado
            console.error(`[Legal One API Service] Falha ao finalizar o documento ${originalFileName}.`);
            if (error.response) {
                console.error("[Legal One API Service] Resposta de Erro:", JSON.stringify(error.response.data, null, 2));
            } else {
                console.error("[Legal One API Service] Erro:", error.message);
            }
            throw error; // Relança o erro para o UseCase
        }
    }

    // ============================================================================
    //  MÉTODO DE DEBUG (SPY)
    // ============================================================================

    /**
     * [DEBUG] Busca o JSON completo de documentos associados a um processo.
     * Usa 'any' para retornar a estrutura *exata* da API, não a nossa interface.
     */
    public async getRawDocuments(lawsuitId: number): Promise<any[]> {
        const token = await this.getAccessToken();
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        const requestUrl = `${apiRestUrl}/Documents`;

        console.log(`[SPY Service] Buscando JSON bruto de documentos para o Lawsuit ID: ${lawsuitId}`);

        const response = await axios.get(requestUrl, { // Retorno como 'any'
            headers: { 'Authorization': `Bearer ${token}` },
            params: {
                '$filter': `relationships/any(r: r/Link eq 'Litigation' and r/LinkItem/Id eq ${lawsuitId})`,
                '$expand': 'relationships,type' // Tenta expandir para ver mais dados
            }
        });

        return response.data.value || [];
    }
}

export const legalOneApiService = new LegalOneApiService();

