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

    // --- Helper Privado ---
    private async getEntityParticipants(endpointType: 'lawsuits' | 'appeals' | 'proceduralissues', entityId: number): Promise<LegalOneParticipant[]> {
        const headers = await this.getAuthHeader();
        const url = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest/${endpointType}/${entityId}/participants`;
        try {
            const response = await axios.get<{ value: LegalOneParticipant[] }>(url, { headers });
            return response.data.value || [];
        } catch (error: any) {
            console.warn(`[Legal One API] Falha ao buscar participantes:`, error.message);
            return [];
        }
    }

    // ============================================================================
    //  BUSCAS DE PROCESSO (ATUALIZADAS COM A LÓGICA DE 3 ETAPAS)
    // ============================================================================

    public async getProcessDetails(processNumber: string): Promise<LegalOneLawsuit> {
        const token = await this.getAccessToken();
        console.log('Token obtido para Legal One API.', token);
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        const requestUrl = `${apiRestUrl}/Lawsuits`;
        const cleanProcessNumber = processNumber.trim();

        let lawsuit: LegalOneLawsuit | null = null;

        // 1. Busca ID (Etapa 1: Leve)
        try {
            console.log(`[Legal One API] (Lawsuit) Buscando ID: ${cleanProcessNumber}`);
            const filterQuery = `identifierNumber eq '${cleanProcessNumber}'`;
            const response = await axios.get<LegalOneLawsuitApiResponse>(requestUrl, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { '$filter': filterQuery } // Sem Expand
            });
            if (response.data.value?.length > 0) lawsuit = response.data.value[0];
        } catch (e) { }

        if (!lawsuit) {
            const unmasked = cleanProcessNumber.replace(/[.\-/]/g, '');
            if (unmasked !== cleanProcessNumber) {
                try {
                    console.log(`[Legal One API] (Lawsuit) Buscando ID sem pontuação: ${unmasked}`);
                    const response = await axios.get<LegalOneLawsuitApiResponse>(requestUrl, {
                        headers: { 'Authorization': `Bearer ${token}` },
                        params: { '$filter': `identifierNumber eq '${unmasked}'` }
                    });
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
        console.log('Token obtido para Legal One API.', token);
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        const requestUrl = `${apiRestUrl}/appeals`;
        const cleanProcessNumber = processNumber.trim();

        let appeal: LegalOneAppeal | null = null;

        // 1. Busca ID
        try {
            const response = await axios.get<LegalOneAppealApiResponse>(requestUrl, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { '$filter': `identifierNumber eq '${cleanProcessNumber}'` }
            });
            if (response.data.value?.length > 0) appeal = response.data.value[0];
        } catch (e) { }

        if (!appeal) throw new Error("Recurso não encontrado");

        // 2. Detalhes (courtPanel)
        try {
            const details = await axios.get<LegalOneAppeal>(`${requestUrl}/${appeal.id}`, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { '$expand': 'courtPanel' }
            });
            appeal = details.data;
        } catch (e) { }

        // 3. Participantes
        const participants = await this.getEntityParticipants('appeals', appeal.id);
        appeal.participants = participants;

        return appeal;
    }

    public async getProceduralIssueDetails(processNumber: string): Promise<LegalOneProceduralIssue> {
        const token = await this.getAccessToken();
        console.log('Token obtido para Legal One API.', token);
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        const requestUrl = `${apiRestUrl}/ProceduralIssues`;
        const cleanProcessNumber = processNumber.trim();

        let issue: LegalOneProceduralIssue | null = null;

        // 1. Busca ID
        try {
            const response = await axios.get<LegalOneProceduralIssueApiResponse>(requestUrl, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { '$filter': `identifierNumber eq '${cleanProcessNumber}'` }
            });

            if (response.data.value?.length > 0) issue = response.data.value[0];
        } catch (e) { }

        if (!issue) throw new Error("Incidente não encontrado");

        // 2. Detalhes
        try {
            const details = await axios.get<LegalOneProceduralIssue>(`${requestUrl}/${issue.id}`, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { '$expand': 'courtPanel' }
            });
            console.log('Resposta da busca de Procedural Issues:', details.data);
            issue = details.data;
        } catch (e) { }

        // 3. Participantes
        const participants = await this.getEntityParticipants('proceduralissues', issue.id);
        issue.participants = participants;

        return issue;
    }


    public async getProcessUpdates(entityId: number): Promise<LegalOneUpdate[]> {
        const token = await this.getAccessToken();


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
    public async listLawsuits(sinceDate?: Date): Promise<LegalOneLawsuit[]> {
        const headers = await this.getAuthHeader();
        const url = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest/Lawsuits`;

        let allLawsuits: LegalOneLawsuit[] = [];

        // Filtro: Se passar data, filtra por creationDate. Se não, pega tudo.
        // Formato OData para data: YYYY-MM-DDTHH:mm:ssZ
        let filter = "";
        if (sinceDate) {
            filter = `creationDate gt ${sinceDate.toISOString()}`;
        }

        // Params iniciais
        let requestUrl: string | null = url + (filter ? `?$filter=${encodeURIComponent(filter)}` : "");

        console.log(`[Legal One API] Listando processos... Filtro: ${filter || 'TODOS'}`);

        try {
            // Loop de paginação (NextLink)
            while (requestUrl) {
                const res: AxiosResponse<LegalOneLawsuitApiResponse> = await axios.get<LegalOneLawsuitApiResponse>(requestUrl, { headers });

                if (res.data.value && res.data.value.length > 0) {
                    allLawsuits = allLawsuits.concat(res.data.value);
                    console.log(`[Legal One API] +${res.data.value.length} processos encontrados. Total parcial: ${allLawsuits.length}`);
                }

                // O Legal One usa '@odata.nextLink' para a próxima página
                // Se for null ou undefined, o loop termina
                requestUrl = res.data['@odata.nextLink'] || null;
            }

            console.log(`[Legal One API] Listagem finalizada. Total: ${allLawsuits.length} processos.`);
            return allLawsuits;
        } catch (error: any) {
            console.error("[Legal One API] Erro ao listar processos:", error.message);
            throw error;
        }
    }
}