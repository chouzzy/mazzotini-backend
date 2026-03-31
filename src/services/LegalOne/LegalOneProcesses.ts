import axios, { AxiosResponse } from 'axios';
import { LegalOneAuth } from './LegalOneAuth';
import {
    LegalOneLawsuit, LegalOneLawsuitApiResponse,
    LegalOneAppeal, LegalOneAppealApiResponse,
    LegalOneProceduralIssue, LegalOneProceduralIssueApiResponse,
    LegalOneUpdate,
    LegalOneParticipant,
    LegalOneUpdatesApiResponse
} from '../legalOneTypes';

export class LegalOneProcesses extends LegalOneAuth {

    // --- Helper ---
    public async getEntityParticipants(endpointType: 'lawsuits' | 'appeals' | 'proceduralissues', entityId: number): Promise<LegalOneParticipant[]> {
        const baseUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest/${endpointType}/${entityId}/participants`;
        let all: LegalOneParticipant[] = [];
        let url: string | null = baseUrl;
        try {
            while (url) {
                const headers = await this.getAuthHeader();
                const response = await axios.get<{ value: LegalOneParticipant[]; '@odata.nextLink'?: string }>(url, { headers });
                all = all.concat(response.data.value || []);
                url = response.data['@odata.nextLink'] || null;
            }
            return all;
        } catch (error: any) {
            console.warn(`[Legal One API] Falha ao buscar participantes:`, error.message);
            return all; // retorna o que já coletou antes do erro
        }
    }

    // ============================================================================
    //  BUSCAS DE PROCESSO (ATUALIZADAS COM A LÓGICA DE 3 ETAPAS)
    // ============================================================================

    /**
         * Helper para lidar com Rate Limit (429) usando Exponential Backoff
         */
    private async requestWithRetry<T>(requestFn: () => Promise<any>, maxRetries = 5): Promise<any> {
        let attempt = 0;
        let baseDelay = 2000; // Começa a esperar 2 segundos

        while (attempt < maxRetries) {
            try {
                // Tenta executar a requisição Axios
                return await requestFn();
            } catch (error: any) {
                // Se o erro for 429 (Too Many Requests)
                if (error.response && error.response.status === 429) {
                    attempt++;
                    console.warn(`[RATE LIMIT] ⚠️ 429 Too Many Requests. Tentativa ${attempt}/${maxRetries}...`);

                    if (attempt >= maxRetries) {
                        console.error(`[RATE LIMIT] ❌ Limite de tentativas excedido.`);
                        throw error;
                    }

                    // Verifica se a API informou quanto tempo devemos esperar (header Retry-After)
                    const retryAfter = error.response.headers['retry-after'];

                    // Se tiver header, usa ele. Se não, dobra o tempo de espera (2s, 4s, 8s, 16s...)
                    const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : baseDelay * Math.pow(2, attempt - 1);

                    console.log(`[RATE LIMIT] ⏳ Aguardando ${waitTime / 1000} segundos antes de tentar de novo...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                } else {
                    // Se for um erro 404, 500, etc., lança o erro normalmente para não mascarar outros problemas
                    throw error;
                }
            }
        }
        throw new Error("Unreachable");
    }

    public async getProcessDetails(processNumber: string): Promise<LegalOneLawsuit> {
        const token = await this.getAccessToken();
        // console.log('Token obtido para Legal One API.', token);
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        const requestUrl = `${apiRestUrl}/Lawsuits`;
        const cleanProcessNumber = processNumber.trim();

        let lawsuit: LegalOneLawsuit | null = null;

        // 1. Busca ID (Etapa 1: Leve)
        try {
            console.log(`[Legal One API] (Lawsuit) Buscando ID: ${cleanProcessNumber}`);
            const filterQuery = `identifierNumber eq '${cleanProcessNumber}'`;
            const response = await this.requestWithRetry(() => axios.get<LegalOneLawsuitApiResponse>(requestUrl, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { '$filter': filterQuery } // Sem Expand
            }));
            if (response.data.value?.length > 0) lawsuit = response.data.value[0];
        } catch (e) { }

        if (!lawsuit) {
            const unmasked = cleanProcessNumber.replace(/[.\-/]/g, '');
            if (unmasked !== cleanProcessNumber) {
                try {
                    console.log(`[Legal One API] (Lawsuit) Buscando ID sem pontuação: ${unmasked}`);
                    const response = await this.requestWithRetry(() => axios.get<LegalOneLawsuitApiResponse>(requestUrl, {
                        headers: { 'Authorization': `Bearer ${token}` },
                        params: { '$filter': `identifierNumber eq '${unmasked}'` }
                    }));
                    if (response.data.value?.length > 0) lawsuit = response.data.value[0];
                } catch (e) { }
            }
        }

        if (!lawsuit) throw new Error(`Nenhum Processo encontrado: ${cleanProcessNumber}`);

        // 2. Busca Detalhes (Etapa 2: Com CourtPanel)
        try {
            // Opcional: Se 'courtPanel' vier no getById, ótimo. Se precisar expandir, faça aqui.
            // A maioria das vezes o getById traz tudo, menos listas grandes.
            const detailsResponse = await axios.get<LegalOneLawsuit>(`${requestUrl}/${lawsuit.id}`, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { '$expand': 'courtPanel' } // Expandimos courtPanel aqui
            });
            lawsuit = detailsResponse.data;
        } catch (e) { console.warn("Falha ao detalhar Lawsuit, usando dados básicos."); }

        // 3. Busca Participantes (Etapa 3: Endpoint Dedicado)
        const participants = await this.getEntityParticipants('lawsuits', lawsuit.id);
        lawsuit.participants = participants;

        return lawsuit;
    }

    public async getAppealDetails(processNumber: string): Promise<LegalOneAppeal> {
        const token = await this.getAccessToken();
        const url = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest/Appeals`;
        const cleanNumber = processNumber.trim();

        // Tentativa 1: Com a formatação original
        try {
            const res = await axios.get<LegalOneAppealApiResponse>(url, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { '$filter': `identifierNumber eq '${cleanNumber}' or oldNumber eq '${cleanNumber}'` }
            });
            if (res.data.value?.length > 0) return res.data.value[0];
        } catch (e) { }

        // Tentativa 2: Sem pontuação
        const unmasked = cleanNumber.replace(/[.\-/]/g, '');
        try {
            const res = await axios.get<LegalOneAppealApiResponse>(url, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { '$filter': `identifierNumber eq '${unmasked}' or oldNumber eq '${unmasked}'` }
            });
            if (res.data.value?.length > 0) return res.data.value[0];
        } catch (e) { }

        throw new Error(`Recurso ${processNumber} não encontrado.`);
    }

    // =================================================================
    // CORREÇÃO: getProceduralIssueDetails com Busca Dupla
    // =================================================================
    public async getProceduralIssueDetails(processNumber: string): Promise<LegalOneProceduralIssue> {
        const token = await this.getAccessToken();
        const url = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest/ProceduralIssues`;
        const cleanNumber = processNumber.trim();

        try {
            const res = await axios.get<LegalOneProceduralIssueApiResponse>(url, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { '$filter': `identifierNumber eq '${cleanNumber}' or oldNumber eq '${cleanNumber}'` }
            });
            if (res.data.value?.length > 0) return res.data.value[0];
        } catch (e) { }

        const unmasked = cleanNumber.replace(/[.\-/]/g, '');
        try {
            const res = await axios.get<LegalOneProceduralIssueApiResponse>(url, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { '$filter': `identifierNumber eq '${unmasked}' or oldNumber eq '${unmasked}'` }
            });
            if (res.data.value?.length > 0) return res.data.value[0];
        } catch (e) { }

        throw new Error(`Incidente ${processNumber} não encontrado.`);
    }


    public async getProcessUpdates(entityId: number): Promise<LegalOneUpdate[]> {
        const token = await this.getAccessToken();
        // console.log(token)


        let allUpdates: LegalOneUpdate[] = [];
        console.log(`[Legal One API] Buscando andamentos para a entidade ID: ${entityId}`);
        const filter = `relationships/any(r: r/linkType eq 'Litigation' and r/linkId eq ${entityId}) and originType eq 'Manual'`;
        let url: string | null = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest/Updates?$filter=${encodeURIComponent(filter)}&$orderby=date desc`;

        try {
            // Loop para percorrer todas as páginas de resultados
            while (url) {
                const res: AxiosResponse<LegalOneUpdatesApiResponse> = await axios.get(url, { headers: { 'Authorization': `Bearer ${token}` } });
                if (res.data.value?.length > 0) {
                    allUpdates = allUpdates.concat(res.data.value);
                }
                // A URL da próxima página é fornecida no campo '@odata.nextLink'
                url = res.data['@odata.nextLink'] || null;
            }
            return allUpdates;
        } catch (e) {
            console.error(`Erro ao buscar andamentos para a entidade ${entityId}:`, e);
            throw e;
        }
    }

    // =================================================================
    //  NOVO MÉTODO: Listar Processos (Com Paginação e Filtro de Data)
    // =================================================================
    private async fetchAllPages(endpoint: string, sinceDate?: Date): Promise<any[]> {
        const headers = await this.getAuthHeader();
        const url = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest/${endpoint}`;

        let allItems: any[] = [];

        // Filtro: Se passar data, filtra por creationDate. Se não, pega tudo.
        let filter = "";
        if (sinceDate) {
            filter = `creationDate gt ${sinceDate.toISOString()}`;
        }

        // Params iniciais
        let requestUrl: string | null = url + (filter ? `?$filter=${encodeURIComponent(filter)}` : "");

        console.log(`[Legal One API] Listando ${endpoint}... Filtro: ${filter || 'TODOS'}`);

        try {
            // O SEU Loop de paginação (NextLink) intocado
            while (requestUrl) {
                const res: any = await axios.get(requestUrl, { headers });

                if (res.data.value && res.data.value.length > 0) {
                    // Adicionamos uma flag invisível para sabermos de onde veio (vai ajudar no Lookup)
                    const itemsWithType = res.data.value.map((item: any) => ({
                        ...item,
                        __legalOneType: endpoint === 'Lawsuits' ? 'Lawsuit' :
                            endpoint === 'Appeals' ? 'Appeal' : 'ProceduralIssue'
                    }));

                    allItems = allItems.concat(itemsWithType);
                    console.log(`[Legal One API] [${endpoint}] +${res.data.value.length} encontrados. Total parcial: ${allItems.length}`);
                }

                // O Legal One usa '@odata.nextLink' para a próxima página
                requestUrl = res.data['@odata.nextLink'] || null;
            }

            console.log(`[Legal One API] [${endpoint}] Listagem finalizada. Total: ${allItems.length}.`);
            return allItems;
        } catch (error: any) {
            console.error(`[Legal One API] Erro ao listar ${endpoint}:`, error.message);
            throw error;
        }
    }

    // 2. O seu listLawsuits agora chama a função acima para as 3 categorias
    public async listLawsuits(sinceDate?: Date): Promise<any[]> {
        console.log(`\n[Legal One API] Iniciando extração completa (Processos, Recursos e Incidentes)...`);

        try {
            const lawsuits = await this.fetchAllPages('Lawsuits', sinceDate);
            const appeals = await this.fetchAllPages('Appeals', sinceDate);
            const proceduralIssues = await this.fetchAllPages('ProceduralIssues', sinceDate);

            // Junta tudo num único array
            const allProcesses = [...lawsuits, ...appeals, ...proceduralIssues];

            console.log(`\n[Legal One API] Extração TOTAL finalizada. Total Absoluto: ${allProcesses.length} itens.`);
            return allProcesses;
        } catch (error) {
            console.error("[Legal One API] Erro na listagem unificada:", error);
            throw error;
        }
    }

    public async getAppealsByLawsuitId(lawsuitId: number): Promise<LegalOneAppeal[]> {
        const headers = await this.getAuthHeader();
        const url = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest/Appeals`;
        try {
            const res = await axios.get<LegalOneAppealApiResponse>(url, {
                headers,
                params: { '$filter': `relatedLitigationId eq ${lawsuitId}` }
            });
            return res.data.value || [];
        } catch (e: any) {
            return [];
        }
    }

    public async getProceduralIssuesByLawsuitId(lawsuitId: number): Promise<LegalOneProceduralIssue[]> {
        const headers = await this.getAuthHeader();
        const url = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest/ProceduralIssues`;
        try {
            const res = await axios.get<LegalOneProceduralIssueApiResponse>(url, {
                headers,
                params: { '$filter': `relatedLitigationId eq ${lawsuitId}` }
            });
            return res.data.value || [];
        } catch (e: any) {
            return [];
        }
    }


}