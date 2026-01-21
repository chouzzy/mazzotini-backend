import axios from 'axios';
import { LegalOneAuth } from './LegalOneAuth';
import { 
    LegalOneUploadContainer, 
    LegalOneDocumentPayload, 
    LegalOneDocumentsApiResponse, 
    LegalOneDocument,
    LegalOneDocumentDownload
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
        // A CORREÇÃO: Filtro OData ajustado para a estrutura real
        // 'Link' e 'LinkItem/Id' (PascalCase é comum em queries OData .NET)
        // =================================================================
        const filterQuery = `relationships/any(r: r/Link eq 'Litigation' and r/LinkItem/Id eq ${lawsuitId})`;

        try {
            const response = await axios.get<LegalOneDocumentsApiResponse>(url, {
                headers,
                params: { '$filter': filterQuery }
            });
            return response.data.value || [];
        } catch (e: any) {
            console.error("Erro ao buscar documentos:", e.response?.data || e.message);
            return [];
        }
    }

    public async getDocumentDownloadUrl(documentId: number): Promise<string> {
        const headers = await this.getAuthHeader();
        const url = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest/Documents/UrlDownload(key=${documentId})`;
        const response = await axios.get<LegalOneDocumentDownload>(url, { headers });
        return response.data.url;
    }
}