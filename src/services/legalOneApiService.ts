import { User } from '@prisma/client';
import axios, { AxiosResponse } from 'axios';
import { maskCPFOrCNPJ, maskRG, unmask } from '../utils/masks';
import {
    LegalOneAppeal,
    LegalOneAppealApiResponse,
    LegalOneCityApiResponse,
    LegalOneContact,
    LegalOneCountryApiResponse,
    LegalOneCreatePersonPayload,
    LegalOneDocument,
    LegalOneDocumentDownload,
    LegalOneDocumentPayload,
    LegalOneDocumentsApiResponse,
    LegalOneLawsuit,
    LegalOneLawsuitApiResponse,
    LegalOnePagedResponse,
    LegalOneProceduralIssue,
    LegalOneProceduralIssueApiResponse,
    LegalOneStateApiResponse,
    LegalOneUpdate,
    LegalOneUpdatesApiResponse,
    LegalOneUploadContainer,
    LegalOneAddress,
} from './legalOneTypes';

// ============================================================================
//  CLASSE DE SERVIÇO PRINCIPAL
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
        console.log(this.accessToken)
        return this.accessToken as string;
    }

    // --- MÉTODOS DE LOOKUP ---

    private async getCountryIdByName(name: string): Promise<number | null> {
        const token = await this.getAccessToken();
        console.log(token)
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        try {
            const response = await axios.get<LegalOneCountryApiResponse>(`${apiRestUrl}/countries`, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { '$filter': `name eq '${name}'` }
            });
            return response.data.value?.[0]?.id || null;
        } catch (error: any) {
            return null;
        }
    }

    private async getStateIdByCode(stateCode: string): Promise<number | null> {
        const token = await this.getAccessToken();
        console.log(token)
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        try {
            const response = await axios.get<LegalOneStateApiResponse>(`${apiRestUrl}/states`, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { '$filter': `stateCode eq '${stateCode}'` }
            });
            return response.data.value?.[0]?.id || null;
        } catch (error: any) {
            return null;
        }
    }

    private async getCityIdByNameAndState(cityName: string, stateId: number): Promise<number | null> {
        const token = await this.getAccessToken();
        console.log(token)
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        try {
            const response = await axios.get<LegalOneCityApiResponse>(`${apiRestUrl}/cities`, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { 
                    '$filter': `name eq '${cityName}' and state/id eq ${stateId}`,
                    '$expand': 'state'
                }
            });
            return response.data.value?.[0]?.id || null;
        } catch (error: any) {
            return null;
        }
    }

    // --- HELPER: CONSTRUTOR DE PAYLOAD ---
    // Atualizado para aceitar 'associateName' e injetar nos customFields
    private async buildPersonPayload(user: User, associateName?: string): Promise<LegalOneCreatePersonPayload> {
        const DEFAULT_COUNTRY_ID = 1; 
        const DEFAULT_CITY_ID = 1; 
        
        const countryName = (user.nationality === "Brasileira" || !user.nationality) ? "Brasil" : user.nationality;
        let countryId = await this.getCountryIdByName(countryName) || DEFAULT_COUNTRY_ID;
        
        let residentialCityId = DEFAULT_CITY_ID;
        if (user.residentialCity && user.residentialState) {
            const stateId = await this.getStateIdByCode(user.residentialState);
            if (stateId) {
                residentialCityId = await this.getCityIdByNameAndState(user.residentialCity, stateId) || DEFAULT_CITY_ID;
            }
        }
        
        let commercialCityId = DEFAULT_CITY_ID;
        if (user.commercialCity && user.commercialState) {
            const stateId = await this.getStateIdByCode(user.commercialState);
            if (stateId) {
                commercialCityId = await this.getCityIdByNameAndState(user.commercialCity, stateId) || DEFAULT_CITY_ID;
            }
        }

        // Definição local para garantir tipos, incluindo customFields
        interface LocalLegalOneCreatePersonPayload extends Omit<LegalOneCreatePersonPayload, 'addresses'> {
            addresses?: any[];
            customFields?: {
                customFieldId: number;
                textValue: string;
            }[];
        }

        const payload: LocalLegalOneCreatePersonPayload = {
            name: user.name,
            identificationNumber: user.cpfOrCnpj ? maskCPFOrCNPJ(user.cpfOrCnpj) : undefined, 
            personStateIdentificationNumber: user.rg ? maskRG(user.rg) : undefined, 
            birthDate: user.birthDate ? new Date(user.birthDate).toISOString().split('T')[0] : undefined,
            gender: user.gender as 'Male' | 'Female', 
            nacionality: user.nationality || undefined,
            country: { id: countryId },
            emails: [
                {
                    email: user.email,
                    isMainEmail: true,
                    isBillingEmail: true,
                    isInvoicingEmail: true,
                    typeId: 1 
                }
            ],
            phones: [],
            addresses: [],
            customFields: []
        };

        // --- Injeção do Nome do Associado ---
        if (associateName && payload.customFields) {
            payload.customFields.push({
                customFieldId: 3706, // ID fixo que você descobriu
                textValue: associateName
            });
        }
        // Nota: Se a profissão for virar Custom Field no futuro, adicionamos aqui.

        if (user.infoEmail) {
            payload.emails.push({
                email: user.infoEmail,
                isMainEmail: false,
                isBillingEmail: false,
                isInvoicingEmail: false,
                typeId: 2 
            });
        }
        if (user.cellPhone) {
            payload.phones?.push({
                number: user.cellPhone,
                isMainPhone: true,
                typeId: 1 
            });
        }
        if (user.phone) {
            payload.phones?.push({
                number: user.phone,
                isMainPhone: false,
                typeId: 2 
            });
        }

        if (user.residentialCep && user.residentialStreet) {
            payload.addresses?.push({
                type: 'Residential',
                addressLine1: user.residentialStreet,
                addressNumber: user.residentialNumber || 'S/N',
                addressLine2: user.residentialComplement || undefined,
                neighborhood: user.residentialNeighborhood || 'N/A',
                cityId: residentialCityId, 
                areaCode: unmask(user.residentialCep),
                isMainAddress: user.correspondenceAddress === 'residential',
                isBillingAddress: (user.commercialCep && user.commercialStreet) ? false : true,
                isInvoicingAddress: (user.commercialCep && user.commercialStreet) ? false : true,
            });
        }

        if (user.commercialCep && user.commercialStreet) {
            payload.addresses?.push({
                type: 'Comercial',
                addressLine1: user.commercialStreet,
                addressNumber: user.commercialNumber || 'S/N',
                addressLine2: user.commercialComplement || undefined,
                neighborhood: user.commercialNeighborhood || 'N/A',
                cityId: commercialCityId, 
                areaCode: unmask(user.commercialCep),
                isMainAddress: user.correspondenceAddress === 'commercial',
                isBillingAddress: true,
                isInvoicingAddress: true,
            });
        }

        return payload as unknown as LegalOneCreatePersonPayload;
    }

    // --- MÉTODOS DE CONTATO ---

    public async getContactByCPF(cpfOrCnpj: string): Promise<LegalOneContact | null> {
        const token = await this.getAccessToken();
        console.log(token)
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        const requestUrl = `${apiRestUrl}/individuals`; 

        const maskedCpfOrCnpj = maskCPFOrCNPJ(cpfOrCnpj);
        console.log(`[Legal One API Service] Buscando (Individual) com CPF/CNPJ mascarado: ${maskedCpfOrCnpj}`);
        const filterQuery = `identificationNumber eq '${maskedCpfOrCnpj}'`;

        try {
            const response = await axios.get<LegalOnePagedResponse<LegalOneContact>>(requestUrl, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { '$filter': filterQuery, '$top': 1 }
            });

            const results = response.data.value;
            if (results && results.length > 0) return results[0]; 
            return null; 
        } catch (error: any) {
            console.error(`[Legal One API Service] Erro ao buscar (Individual) por CPF: ${error.message}`);
            return null;
        }
    }

    public async getContactByRG(rg: string): Promise<LegalOneContact | null> {
        const token = await this.getAccessToken();
        console.log(token)
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        const requestUrl = `${apiRestUrl}/individuals`; 
        const maskedRg = maskRG(rg); 
        console.log(`[Legal One API Service] Buscando (Individual) com RG mascarado: ${maskedRg}`);
        const filterQuery = `personStateIdentificationNumber eq '${maskedRg}'`;
        try {
            const response = await axios.get<LegalOnePagedResponse<LegalOneContact>>(requestUrl, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { '$filter': filterQuery, '$top': 1 }
            });
            const results = response.data.value;
            if (results && results.length > 0) return results[0]; 
            return null; 
        } catch (error: any) {
            return null;
        }
    }

    public async getIndividualDetails(contactId: number): Promise<LegalOneContact> {
        const token = await this.getAccessToken();
        console.log(token)
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        const requestUrl = `${apiRestUrl}/individuals/${contactId}`;

        console.log(`[Legal One API Service] Buscando detalhes completos do Individual ID: ${contactId}`);
        const response = await axios.get<LegalOneContact>(requestUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data;
    }

    // ATUALIZADO: Aceita associateName
    public async createContact(user: User, associateName?: string): Promise<LegalOneContact> {
        const token = await this.getAccessToken();
        console.log(token)
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        const requestUrl = `${apiRestUrl}/individuals`;
        
        console.log(`[Legal One API Service] A criar novo contato (Individual): ${user.name}`);
        const payload = await this.buildPersonPayload(user, associateName);

        try {
            const response = await axios.post<LegalOneContact>(requestUrl, payload, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log(`[Legal One API Service] Resposta Create:`, response.data);
            return response.data;
        } catch (error: any) {
            if (error.response?.data) console.log('[Legal One API Service] Erro create:', JSON.stringify(error.response.data, null, 2));
            throw new Error("Erro ao criar contato no Legal One.");
        }
    }

    // ============================================================================
    //  ATUALIZAR CONTATO (COM CUSTOM FIELDS)
    // ============================================================================
    // ATUALIZADO: Aceita associateName
    public async updateContact(contactId: number, user: User, associateName?: string): Promise<void> {
        const token = await this.getAccessToken();
        console.log(token)
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        const requestUrl = `${apiRestUrl}/individuals/${contactId}`;

        console.log(`[Legal One API Service] Iniciando atualização profunda do contato ID: ${contactId}`);

        // 1. Gera o payload (incluindo customFields se tiver associateName)
        // Precisamos usar 'any' temporariamente para acessar customFields que buildPersonPayload gera
        const newPayloadAny = await this.buildPersonPayload(user, associateName) as any;
        
        // 2. Atualiza Dados Básicos (Raiz) - Remove campos proibidos no PATCH raiz
        // 'customFields' também não pode ir no PATCH raiz segundo a documentação
        const { country, emails, phones, addresses, customFields, ...basicPayload } = newPayloadAny;
        
        try {
            await axios.patch(requestUrl, basicPayload, {
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
            });
            console.log(`[Legal One API Service] Dados básicos atualizados.`);
        } catch (error: any) {
            console.error('[Legal One API Service] Erro ao atualizar dados básicos:', error.response?.data || error.message);
        }

        // 3. Busca dados atuais do Legal One
        let currentContact: LegalOneContact;
        try {
            currentContact = await this.getIndividualDetails(contactId);
        } catch (error) {
            console.error('[Legal One API Service] Não foi possível buscar detalhes para atualizar sub-recursos.');
            return;
        }

        // 4. Atualiza E-mails (Lógica existente)
        if (currentContact.emails && currentContact.emails.length > 0 && newPayloadAny.emails.length > 0) {
            const mainCurrentEmail = currentContact.emails.find(e => e.isMainEmail) || currentContact.emails[0];
            const mainNewEmail = newPayloadAny.emails.find((e: any) => e.isMainEmail) || newPayloadAny.emails[0];
            if (mainCurrentEmail && mainNewEmail) {
                try {
                    const emailPayload = { ...mainNewEmail, id: mainCurrentEmail.id };
                    await axios.patch(`${apiRestUrl}/individuals/${contactId}/emails/${mainCurrentEmail.id}`, emailPayload, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                } catch (err: any) { console.error('Erro update email:', err.message); }
            }
        }

        // 5. Atualiza Telefones (Lógica existente)
        if (currentContact.phones && currentContact.phones.length > 0 && newPayloadAny.phones && newPayloadAny.phones.length > 0) {
            const mainCurrentPhone = currentContact.phones.find(p => p.isMainPhone) || currentContact.phones[0];
            const mainNewPhone = newPayloadAny.phones.find((p: any) => p.isMainPhone) || newPayloadAny.phones[0];
            if (mainCurrentPhone && mainNewPhone) {
                try {
                    const phonePayload = { ...mainNewPhone, id: mainCurrentPhone.id };
                    await axios.patch(`${apiRestUrl}/individuals/${contactId}/phones/${mainCurrentPhone.id}`, phonePayload, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                } catch (err: any) { console.error('Erro update phone:', err.message); }
            }
        }

        // 6. Atualiza Endereços (Lógica existente)
        if (newPayloadAny.addresses && newPayloadAny.addresses.length > 0) {
            try {
                const addrResponse = await axios.get<LegalOnePagedResponse<LegalOneAddress>>(`${apiRestUrl}/individuals/${contactId}/addresses`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const existingAddresses = addrResponse.data.value || [];
                for (const newAddr of newPayloadAny.addresses) {
                    let match = null;
                    if (newAddr.isMainAddress) {
                        match = existingAddresses.find(a => a.isMainAddress);
                    } else {
                        match = existingAddresses.find(a => !a.isMainAddress && a.type === newAddr.type);
                    }
                    if (match) {
                        await axios.patch(`${apiRestUrl}/individuals/${contactId}/addresses/${match.id}`, {
                            ...newAddr,
                            id: match.id
                        }, { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } });
                    } else {
                        await axios.post(`${apiRestUrl}/individuals/${contactId}/addresses`, newAddr, {
                            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
                        });
                    }
                }
            } catch (err: any) {
                console.error('[Legal One API Service] Erro ao processar endereços:', err.message);
            }
        }

        // 7. Atualiza Custom Fields (Associado)
        if (customFields && customFields.length > 0) {
            console.log("[Legal One API Service] Atualizando campos personalizados...");
            try {
                // a. Busca os custom fields existentes
                const cfResponse = await axios.get(`${apiRestUrl}/individuals/${contactId}/customFields`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                // A estrutura de resposta pode variar, assumindo value[]
                const existingCustomFields = (cfResponse.data.value || []) as any[];

                for (const newCF of customFields) {
                    // Tenta achar se esse campo (3706) já tem valor definido
                    const match = existingCustomFields.find(cf => cf.customFieldId === newCF.customFieldId);

                    if (match) {
                        // PATCH
                        console.log(`[Legal One API Service] Atualizando CustomField ${newCF.customFieldId}...`);
                        await axios.patch(`${apiRestUrl}/individuals/${contactId}/customFields/${match.id}`, {
                            id: match.id,
                            ...newCF
                        }, { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } });
                    } else {
                        // POST
                        console.log(`[Legal One API Service] Criando valor para CustomField ${newCF.customFieldId}...`);
                        await axios.post(`${apiRestUrl}/individuals/${contactId}/customFields`, newCF, {
                            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
                        });
                    }
                }
            } catch (err: any) {
                console.error('[Legal One API Service] Erro ao processar Custom Fields:', err.message);
                if (err.response) console.error(JSON.stringify(err.response.data));
            }
        }
    }


    // --- FLUXO DE UPLOAD ---
    public async getUploadContainer(fileExtension: string): Promise<LegalOneUploadContainer> {
        const token = await this.getAccessToken();
        console.log(token)
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        const requestUrl = `${apiRestUrl}/documents/getcontainer(fileExtension='${fileExtension}')`;
        const response = await axios.get<LegalOneUploadContainer>(requestUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data;
    }

    public async uploadFileToContainer(containerUrl: string, fileBuffer: Buffer, mimeType: string): Promise<void> {
        await axios.put(containerUrl, fileBuffer, {
            headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': mimeType }
        });
    }

    public async finalizeDocument(fileNameInContainer: string, originalFileName: string, contactId: number): Promise<void> {
        const token = await this.getAccessToken();
        console.log(token)
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        const requestUrl = `${apiRestUrl}/Documents`;
        const payload: LegalOneDocumentPayload = {
            archive: originalFileName,
            description: `#SM ${originalFileName}`, 
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
            fileName: fileNameInContainer, 
            isPhysicallyStored: false,
            isModel: false,
            relationships: [
                { Link: 'Contact', LinkItem: { Id: contactId, Description: originalFileName } }
            ]
        };
        try {
            await axios.post(requestUrl, payload, {
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
            });
        } catch (error: any) {
            throw error; 
        }
    }

    // --- GETTERS DE PROCESSO (Mantidos) ---
    public async getProcessDetails(processNumber: string): Promise<LegalOneLawsuit> {
        const token = await this.getAccessToken();
        console.log(token)
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        const requestUrl = `${apiRestUrl}/Lawsuits`;
        const cleanProcessNumber = processNumber.trim();
        try {
            const filterQueryV1 = `identifierNumber eq '${cleanProcessNumber}' or otherNumber eq '${cleanProcessNumber}'`;
            const response = await axios.get<LegalOneLawsuitApiResponse>(requestUrl, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { '$filter': filterQueryV1, '$expand': 'participants,courtPanel' }
            });
            if (response.data.value?.length > 0) return response.data.value[0]; 
        } catch (error: any) {}
        const unmaskedProcessNumber = cleanProcessNumber.replace(/[.\-/]/g, '');
        if (unmaskedProcessNumber === cleanProcessNumber) throw new Error(`Nenhum Processo encontrado: ${cleanProcessNumber}`);
        try {
            const filterQueryV2 = `identifierNumber eq '${unmaskedProcessNumber}' or otherNumber eq '${unmaskedProcessNumber}'`;
            const response = await axios.get<LegalOneLawsuitApiResponse>(requestUrl, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { '$filter': filterQueryV2, '$expand': 'participants,courtPanel' }
            });
            const results = response.data.value;
            if (results && results.length > 0) return results[0];
        } catch (error: any) { throw new Error(`Nenhum Processo encontrado: ${cleanProcessNumber}`); }
        throw new Error(`Nenhum Processo encontrado: ${cleanProcessNumber}`);
    }

    public async getAppealDetails(processNumber: string): Promise<LegalOneAppeal> {
        const token = await this.getAccessToken();
        console.log(token)
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        try {
             const response = await axios.get<LegalOneAppealApiResponse>(`${apiRestUrl}/appeals`, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { '$filter': `identifierNumber eq '${processNumber.trim()}'`, '$expand': 'participants,courtPanel' }
            });
            if (response.data.value?.length > 0) return response.data.value[0];
        } catch(e) {}
        throw new Error("Recurso não encontrado");
    }

    public async getProceduralIssueDetails(processNumber: string): Promise<LegalOneProceduralIssue> {
         const token = await this.getAccessToken();
         console.log(token)
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        try {
             const response = await axios.get<LegalOneProceduralIssueApiResponse>(`${apiRestUrl}/ProceduralIssues`, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { '$filter': `identifierNumber eq '${processNumber.trim()}'`, '$expand': 'participants,courtPanel' }
            });
            if (response.data.value?.length > 0) return response.data.value[0];
        } catch(e) {}
        throw new Error("Incidente não encontrado");
    }

    public async getProcessUpdates(entityId: number): Promise<LegalOneUpdate[]> {
        const token = await this.getAccessToken();
        console.log(token)
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        let allUpdates: LegalOneUpdate[] = [];
        const filterQuery = `relationships/any(r: r/linkType eq 'Litigation' and r/linkId eq ${entityId}) and originType eq 'Manual'`;
        let requestUrl: string | null = `${apiRestUrl}/Updates?$filter=${encodeURIComponent(filterQuery)}&$orderby=date desc`;
        try {
            while (requestUrl) {
                const response: AxiosResponse<LegalOneUpdatesApiResponse> = await axios.get(requestUrl, { headers: { 'Authorization': `Bearer ${token}` } });
                if (response.data.value?.length > 0) allUpdates = allUpdates.concat(response.data.value);
                requestUrl = response.data['@odata.nextLink'] || null; 
            }
            return allUpdates;
        } catch (error: any) { throw error; }
    }
}

export const legalOneApiService = new LegalOneApiService();