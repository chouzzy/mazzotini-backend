import axios from 'axios';
import { LegalOneAuth } from './LegalOneAuth';
import {
    LegalOneUploadContainer,
    LegalOneDocumentPayload,
    LegalOneDocumentsApiResponse,
    LegalOneDocument,
    LegalOneDocumentDownload,
    LegalOneFeeContract,
    LegalOneServiceParticipant,
} from '../legalOneTypes';

export class LegalOneDocuments extends LegalOneAuth {

    public async getUploadContainer(fileExtension: string): Promise<LegalOneUploadContainer> {
        const headers = await this.getAuthHeader();
        const url = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest/documents/getcontainer(fileExtension='${fileExtension}')`;
        const response = await axios.get<LegalOneUploadContainer>(url, { headers });
        return response.data;
    }

    public async uploadFileToContainer(containerUrl: string, fileBuffer: Buffer, mimeType: string): Promise<void> {
        await axios.put(containerUrl, fileBuffer, {
            headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': mimeType }
        });
    }

    public async finalizeDocument(fileNameInContainer: string, originalFileName: string, contactId: number): Promise<void> {
        const headers = await this.getAuthHeader();
        const url = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest/Documents`;

        const taggedName = `#DocumentoMAA ${originalFileName}`;

        const payload: LegalOneDocumentPayload = {
            archive: taggedName,
            fileName: fileNameInContainer,
            description: taggedName,
            generateUrlDownload: "",
            typeId: null,
            type: "Documento / Guia",
            repository: "LegalOne",
            notes: null,
            phisicalLocalization: null,
            author: null,
            beginDate: null,
            endDate: null,
            fileUploader: null,
            isPhysicallyStored: false,
            isModel: false,
            relationships: [{
                link: 'Contact', // camelCase aqui para POST/PATCH (JSON)
                linkItem: { id: contactId, description: taggedName }
            }]
        };

        await axios.post(url, payload, {
            headers: { ...headers, 'Content-Type': 'application/json' }
        });
    }

   public async getProcessDocuments(lawsuitId: number): Promise<LegalOneDocument[]> {
        const headers = await this.getAuthHeader();
        const url = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest/Documents`;

        // =================================================================
        // CORREÇÃO DEFINITIVA: Inconsistência da API do Legal One!
        // Ao contrário dos Andamentos, Documentos ainda usam 'link' e 'linkItem/id'
        // =================================================================
        const filterQuery = `relationships/any(r: r/link eq 'Litigation' and r/linkItem/id eq ${lawsuitId})`;

        try {
            const response = await axios.get<LegalOneDocumentsApiResponse>(url, {
                headers,
                params: { '$filter': filterQuery }
            });
            return response.data.value || [];
        } catch (e: any) {
            console.error("[Legal One API] Erro ao buscar documentos:", e.response?.data || e.message);
            return [];
        }
    }


    public async getDocumentDownloadUrl(documentId: number): Promise<string> {
        const headers = await this.getAuthHeader();
        const url = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest/Documents/UrlDownload(key=${documentId})`;
        const response = await axios.get<LegalOneDocumentDownload>(url, { headers });
        return response.data.url;
    }

    /** Lista todos os contratos de honorário cujas pastas começam com 'Proc-' */
    public async listFeeContracts(): Promise<LegalOneFeeContract[]> {
        type PageResponse = { value: LegalOneFeeContract[]; '@odata.nextLink'?: string };
        const headers = await this.getAuthHeader();
        const base = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest/services`;
        let all: LegalOneFeeContract[] = [];
        let nextUrl: string | null = base;
        let isFirst = true;

        while (nextUrl) {
            const currentUrl: string = nextUrl;
            const res = await axios.get<PageResponse>(currentUrl, {
                headers,
                params: isFirst ? {
                    '$filter': "startswith(folder, 'Proc-')",
                    '$select': 'id,folder,status',
                } : undefined,
            });
            isFirst = false;
            all = all.concat(res.data.value || []);
            nextUrl = res.data['@odata.nextLink'] || null;
        }
        return all;
    }

    /** Participantes de um contrato de honorário */
    public async getServiceParticipants(serviceId: number): Promise<LegalOneServiceParticipant[]> {
        const headers = await this.getAuthHeader();
        const res = await axios.get<{ value: LegalOneServiceParticipant[] }>(
            `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest/services/${serviceId}/participants`,
            { headers }
        );
        return res.data.value || [];
    }

    /** CPF/CNPJ de um contato pelo ID (tenta PF, depois PJ) */
    public async getContactIdentification(contactId: number): Promise<string | null> {
        const headers = await this.getAuthHeader();
        for (const endpoint of ['individuals', 'companies']) {
            try {
                const res = await axios.get<{ identificationNumber?: string }>(
                    `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest/${endpoint}/${contactId}`,
                    { headers, params: { '$select': 'id,identificationNumber' } }
                );
                const raw = res.data.identificationNumber;
                if (raw) return raw.replace(/[.\-\/\s]/g, '');
            } catch { /* tenta próximo */ }
        }
        return null;
    }

    /** Documentos de um contrato de honorário (link eq 'Contract') */
    public async getContractDocuments(serviceId: number): Promise<LegalOneDocument[]> {
        const headers = await this.getAuthHeader();
        const filter = `relationships/any(r: r/link eq 'Contract' and r/linkItem/id eq ${serviceId})`;
        try {
            const res = await axios.get<LegalOneDocumentsApiResponse>(
                `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest/Documents`,
                { headers, params: { '$filter': filter } }
            );
            return res.data.value || [];
        } catch (e: any) {
            console.error('[Legal One API] Erro ao buscar docs do contrato:', e.response?.data || e.message);
            return [];
        }
    }

    /**
     * Busca todos os documentos privados de clientes:
     * type começa com '#' + vínculo Contract (Contrato de Honorários).
     * Retorna com relationships expandidas para extrair Contact e folder.
     */
    public async getPrivateDocuments(): Promise<LegalOneDocument[]> {
        type PageResponse = { value: LegalOneDocument[]; '@odata.nextLink'?: string };
        const headers = await this.getAuthHeader();
        const base = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest/Documents`;
        let all: LegalOneDocument[] = [];
        let nextUrl: string | null = base;
        let isFirst = true;

        while (nextUrl) {
            const currentUrl: string = nextUrl;
            const res = await axios.get<PageResponse>(currentUrl, {
                headers,
                params: isFirst ? {
                    '$filter': "startswith(type,'#') and relationships/any(r: r/link eq 'Contract')",
                    '$expand': 'relationships',
                } : undefined,
            });
            isFirst = false;
            all = all.concat(res.data.value || []);
            nextUrl = res.data['@odata.nextLink'] || null;
        }
        return all;
    }
}