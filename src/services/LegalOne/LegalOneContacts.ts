import axios from 'axios';
import { User } from '@prisma/client';
import { LegalOneAuth } from './LegalOneAuth';
import { maskCPFOrCNPJ, maskRG, unmask } from '../../utils/masks';
import {
    LegalOneContact,
    LegalOneCreatePersonPayload,
    LegalOnePagedResponse,
    LegalOneCountryApiResponse,
    LegalOneStateApiResponse,
    LegalOneCityApiResponse,
    LegalOneAddress
} from '../legalOneTypes';

export class LegalOneContacts extends LegalOneAuth {

    // ============================================================================
    //  MÉTODOS PRIVADOS DE LOOKUP (GEOGRAFIA)
    // ============================================================================

    private async getCountryIdByName(name: string): Promise<number | null> {
        const headers = await this.getAuthHeader();
        try {
            const res = await axios.get<LegalOneCountryApiResponse>(`${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest/countries`, {
                headers, params: { '$filter': `name eq '${name}'` }
            });
            return res.data.value?.[0]?.id || null;
        } catch { return null; }
    }

    private async getStateIdByCode(stateCode: string): Promise<number | null> {
        const headers = await this.getAuthHeader();
        try {
            const res = await axios.get<LegalOneStateApiResponse>(`${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest/states`, {
                headers, params: { '$filter': `stateCode eq '${stateCode}'` }
            });
            return res.data.value?.[0]?.id || null;
        } catch { return null; }
    }

    private async getCityIdByNameAndState(cityName: string, stateId: number): Promise<number | null> {
        const headers = await this.getAuthHeader();
        try {
            const res = await axios.get<LegalOneCityApiResponse>(`${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest/cities`, {
                headers, params: { '$filter': `name eq '${cityName}' and state/id eq ${stateId}`, '$expand': 'state' }
            });
            return res.data.value?.[0]?.id || null;
        } catch { return null; }
    }

    // ============================================================================
    //  HELPER: CONSTRUTOR DE PAYLOAD (PF/PJ)
    // ============================================================================
    private async buildPersonPayload(user: User): Promise<LegalOneCreatePersonPayload> {
        const DEFAULT_COUNTRY_ID = 1; // Brasil
        const DEFAULT_CITY_ID = 1; // Default

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

        const payload: LegalOneCreatePersonPayload = {
            name: user.name,
            identificationNumber: user.cpfOrCnpj ? maskCPFOrCNPJ(user.cpfOrCnpj) : undefined,
            personStateIdentificationNumber: user.rg ? maskRG(user.rg) : undefined,
            birthDate: user.birthDate ? new Date(user.birthDate).toISOString().split('T')[0] : undefined,
            gender: user.gender as 'Male' | 'Female',
            nacionality: user.nationality || undefined,
            country: { id: countryId },
            emails: [{
                email: user.email,
                isMainEmail: true,
                isBillingEmail: true,
                isInvoicingEmail: true,
                typeId: 1
            }],
            phones: [],
            addresses: [],
        };

        if (user.infoEmail) {
            payload.emails.push({ email: user.infoEmail, isMainEmail: false, isBillingEmail: false, isInvoicingEmail: false, typeId: 2 });
        }
        if (user.cellPhone) {
            payload.phones.push({ number: user.cellPhone, isMainPhone: true, typeId: 1 });
        }
        if (user.phone) {
            payload.phones.push({ number: user.phone, isMainPhone: false, typeId: 2 });
        }

        if (user.residentialCep && user.residentialStreet) {
            payload.addresses?.push({
                type: 'Residential',
                addressLine1: user.residentialStreet,
                addressNumber: user.residentialNumber || 'S/N',
                addressLine2: user.residentialComplement || undefined,
                neighborhood: user.residentialNeighborhood || 'N/A',
                cityId: residentialCityId,
                areaCode: unmask(user.residentialCep), // Envia CEP limpo para areaCode
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
                areaCode: unmask(user.commercialCep), // Envia CEP limpo para areaCode
                isMainAddress: user.correspondenceAddress === 'commercial',
                isBillingAddress: true,
                isInvoicingAddress: true,
            });
        }
        return payload;
    }

    // ============================================================================
    //  HELPER: ATUALIZAR CAMPO PERSONALIZADO (Associado)
    // ============================================================================
    private async updateAssociateCustomField(contactId: number, associateName: string, isPJ: boolean): Promise<void> {
        const headers = await this.getAuthHeader();
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;

        const endpointType = isPJ ? 'companies' : 'individuals';
        const ASSOCIATE_FIELD_ID = isPJ ? 3688 : 3706;

        console.log(`[Legal One API] Atualizando Associado (${associateName}) para ID ${contactId} em /${endpointType}`);

        try {
            const res = await axios.get(`${apiRestUrl}/${endpointType}/${contactId}/customFields`, { headers });
            const existingField = (res.data.value || []).find((cf: any) => cf.customFieldId === ASSOCIATE_FIELD_ID);

            if (existingField) {
                await axios.patch(`${apiRestUrl}/${endpointType}/${contactId}/customFields/${existingField.id}`, {
                    id: existingField.id,
                    customFieldId: ASSOCIATE_FIELD_ID,
                    textValue: associateName,
                    booleanValue: null, listItemIdValue: null, contactIdValue: null, dateValue: null, currencyValue: null
                }, { headers: { ...headers, 'Content-Type': 'application/json' } });
            } else {
                await axios.post(`${apiRestUrl}/${endpointType}/${contactId}/customFields`, {
                    customFieldId: ASSOCIATE_FIELD_ID,
                    textValue: associateName
                }, { headers: { ...headers, 'Content-Type': 'application/json' } });
            }
        } catch (err: any) {
            console.error('[Legal One API] Falha no Custom Field:', err.message);
        }
    }

    // ============================================================================
    //  MÉTODOS PÚBLICOS
    // ============================================================================

    public async getContactByCPF(cpfOrCnpj: string): Promise<LegalOneContact | null> {
        const headers = await this.getAuthHeader();
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;

        const cleanDoc = unmask(cpfOrCnpj);
        const isPJ = cleanDoc.length > 11;
        const endpointType = isPJ ? 'companies' : 'individuals';
        const maskedDoc = maskCPFOrCNPJ(cpfOrCnpj);

        console.log(`[Legal One API] Buscando em /${endpointType} por: ${maskedDoc}`);
        const filterQuery = `identificationNumber eq '${maskedDoc}'`;

        try {
            const res = await axios.get<LegalOnePagedResponse<LegalOneContact>>(`${apiRestUrl}/${endpointType}`, {
                headers, params: { '$filter': filterQuery, '$top': 1 }
            });
            return res.data.value?.[0] || null;
        } catch { return null; }
    }

    public async getContactByRG(rg: string): Promise<LegalOneContact | null> {
        const headers = await this.getAuthHeader();
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        try {
            const res = await axios.get<LegalOnePagedResponse<LegalOneContact>>(`${apiRestUrl}/individuals`, {
                headers, params: { '$filter': `personStateIdentificationNumber eq '${maskRG(rg)}'`, '$top': 1 }
            });
            return res.data.value?.[0] || null;
        } catch { return null; }
    }

    public async getContactDetails(contactId: number, isPJ: boolean): Promise<LegalOneContact> {
        const headers = await this.getAuthHeader();
        const endpointType = isPJ ? 'companies' : 'individuals';
        const url = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest/${endpointType}/${contactId}`;

        const res = await axios.get<LegalOneContact>(url, { headers });
        return res.data;
    }

    public async getIndividualDetails(contactId: number, isPJ: boolean = false): Promise<LegalOneContact> {
        const token = await this.getAccessToken();
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        const endpointType = isPJ ? 'companies' : 'individuals';
        const response = await axios.get<LegalOneContact>(`${apiRestUrl}/${endpointType}/${contactId}`, { headers: { 'Authorization': `Bearer ${token}` } });
        return response.data;
    }

    public async createContact(user: User, associateName?: string): Promise<LegalOneContact> {
        const headers = await this.getAuthHeader();
        const cleanDoc = user.cpfOrCnpj ? unmask(user.cpfOrCnpj) : '';
        const isPJ = cleanDoc.length > 11;
        const endpointType = isPJ ? 'companies' : 'individuals';

        console.log(`[Legal One API] Criando contato (${endpointType}): ${user.name}`);
        const payload = await this.buildPersonPayload(user);

        try {
            const res = await axios.post<LegalOneContact>(`${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest/${endpointType}`, payload, { headers });
            const newContact = res.data;
            if (associateName) await this.updateAssociateCustomField(newContact.id, associateName, isPJ);
            return newContact;
        } catch (error: any) {
            if (error.response?.data) console.log('[Legal One API] Erro create:', JSON.stringify(error.response.data));
            throw new Error("Erro ao criar contato no Legal One.");
        }
    }

    public async updateContact(contactId: number, user: User, associateName?: string): Promise<void> {
        const token = await this.getAccessToken();
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        const cleanDoc = user.cpfOrCnpj ? unmask(user.cpfOrCnpj) : '';
        const isPJ = cleanDoc.length > 11;
        const endpointType = isPJ ? 'companies' : 'individuals';

        console.log(`[Legal One API] Atualizando ID ${contactId} em /${endpointType}`);
        const newPayload = await this.buildPersonPayload(user) as any;

        // Remove campos proibidos no PATCH raiz
        const { country, emails, phones, addresses, personStateIdentificationNumber, birthDate, gender, nacionality, ...basicPayload } = newPayload;

        // Se for PF, reinjeta campos permitidos
        let payloadToSend = { ...basicPayload };
        if (!isPJ) {
            if (newPayload.birthDate) payloadToSend.birthDate = newPayload.birthDate;
            if (newPayload.gender) payloadToSend.gender = newPayload.gender;
            if (newPayload.nacionality) payloadToSend.nacionality = newPayload.nacionality;
            if (newPayload.personStateIdentificationNumber) payloadToSend.personStateIdentificationNumber = newPayload.personStateIdentificationNumber;
        }

        try {
            await axios.patch(`${apiRestUrl}/${endpointType}/${contactId}`, payloadToSend, { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } });
            console.log(`[Legal One API] Dados básicos atualizados.`);
        } catch (e: any) { console.error('Erro update root:', e.response?.data || e.message); }

        if (associateName) await this.updateAssociateCustomField(contactId, associateName, isPJ);

        let currentContact: LegalOneContact;
        try { currentContact = await this.getIndividualDetails(contactId, isPJ); } catch { return; }

        // Update Emails
        if (currentContact.emails && newPayload.emails.length > 0) {
            const mainNew = newPayload.emails.find((e: any) => e.isMainEmail);
            const mainCurr = currentContact.emails.find(e => e.isMainEmail) || currentContact.emails[0];
            if (mainNew) {
                try {
                    if (mainCurr) await axios.patch(`${apiRestUrl}/${endpointType}/${contactId}/emails/${mainCurr.id}`, { ...mainNew, id: mainCurr.id }, { headers: { 'Authorization': `Bearer ${token}` } });
                    else await axios.post(`${apiRestUrl}/${endpointType}/${contactId}/emails`, mainNew, { headers: { 'Authorization': `Bearer ${token}` } });
                } catch (e: any) { console.error('Erro email:', JSON.stringify(e.response?.data || e.message)); }
            }
        }

        // Update Phones
        if (currentContact.phones && newPayload.phones.length > 0) {
            const mainNew = newPayload.phones.find((p: any) => p.isMainPhone);
            const mainCurr = currentContact.phones.find(p => p.isMainPhone) || currentContact.phones[0];
            if (mainNew) {
                try {
                    if (mainCurr) await axios.patch(`${apiRestUrl}/${endpointType}/${contactId}/phones/${mainCurr.id}`, { ...mainNew, id: mainCurr.id }, { headers: { 'Authorization': `Bearer ${token}` } });
                    else await axios.post(`${apiRestUrl}/${endpointType}/${contactId}/phones`, mainNew, { headers: { 'Authorization': `Bearer ${token}` } });
                } catch (e: any) { console.error('Erro phone:', JSON.stringify(e.response?.data || e.message)); }
            }
        }

        // Update Addresses
        if (newPayload.addresses && newPayload.addresses.length > 0) {
            try {
                const addrRes = await axios.get<LegalOnePagedResponse<LegalOneAddress>>(`${apiRestUrl}/${endpointType}/${contactId}/addresses`, { headers: { 'Authorization': `Bearer ${token}` } });
                const existingAddresses = addrRes.data.value || [];
                for (const newAddr of newPayload.addresses) {
                    let match = newAddr.isMainAddress ? existingAddresses.find(a => a.isMainAddress) : existingAddresses.find(a => !a.isMainAddress && a.type === newAddr.type);
                    if (match) {
                        await axios.patch(`${apiRestUrl}/${endpointType}/${contactId}/addresses/${match.id}`, { ...newAddr, id: match.id }, { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } });
                    } else {
                        await axios.post(`${apiRestUrl}/${endpointType}/${contactId}/addresses`, newAddr, { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } });
                    }
                }
            } catch (e: any) { console.error('Erro endereços:', JSON.stringify(e.response?.data || e.message)); }
        }
    }
}