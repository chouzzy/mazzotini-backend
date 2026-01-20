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
    LegalOneParticipant
} from './legalOneTypes';

/**
 * Serviço para interagir com a API do Legal One.
 * Gerencia autenticação, criação, atualização e consulta de dados como
 * contatos (pessoas físicas/jurídicas), processos e documentos.
 */
class LegalOneApiService {
    private accessToken: string | null = null;
    private tokenExpiresAt: number | null = null;

    /**
     * Obtém um token de acesso OAuth2, utilizando um cache interno para evitar requisições desnecessárias.
     * Se o token estiver expirado ou não existir, solicita um novo.
     * @returns {Promise<string>} O token de acesso válido.
     * @private
     */
    private async getAccessToken(): Promise<string> {
        // Retorna o token do cache se ele for válido
        if (this.accessToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt) {
            return this.accessToken;
        }

        console.log("[Legal One API Service] Obtendo novo token de acesso...");
        const key = process.env.LEGAL_ONE_CONSUMER_KEY;
        const secret = process.env.LEGAL_ONE_CONSUMER_SECRET;
        const baseUrl = process.env.LEGAL_ONE_API_BASE_URL;

        if (!key || !secret || !baseUrl) {
            throw new Error("Credenciais da API Legal One não configuradas no ambiente.");
        }

        const tokenUrl = `${baseUrl}/oauth?grant_type=client_credentials`;
        const authHeader = `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`;

        const response = await axios.get(tokenUrl, {
            headers: { 'Authorization': authHeader }
        });


        const { access_token, expires_in } = response.data;
        this.accessToken = access_token;
        // Armazena o tempo de expiração com uma margem de segurança de 60 segundos
        this.tokenExpiresAt = Date.now() + (expires_in - 60) * 1000;

        return this.accessToken as string;
    }

    // --- MÉTODOS DE CONSULTA (LOOKUPS) ---

    /**
     * Busca o ID de um país na API pelo nome.
     * @param {string} name - Nome do país (ex: "Brasil").
     * @returns {Promise<number | null>} O ID do país ou nulo se não encontrado.
     * @private
     */
    private async getCountryIdByName(name: string): Promise<number | null> {
        const token = await this.getAccessToken();
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        try {
            const response = await axios.get<LegalOneCountryApiResponse>(`${apiRestUrl}/countries`, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { '$filter': `name eq '${name}'` }
            });
            return response.data.value?.[0]?.id || null;
        } catch {
            return null;
        }
    }

    /**
     * Busca o ID de um estado na API pela sua sigla.
     * @param {string} stateCode - Sigla do estado (ex: "SP").
     * @returns {Promise<number | null>} O ID do estado ou nulo se não encontrado.
     * @private
     */
    private async getStateIdByCode(stateCode: string): Promise<number | null> {
        const token = await this.getAccessToken();
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        try {
            const response = await axios.get<LegalOneStateApiResponse>(`${apiRestUrl}/states`, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { '$filter': `stateCode eq '${stateCode}'` }
            });
            return response.data.value?.[0]?.id || null;
        } catch {
            return null;
        }
    }

    /**
     * Busca o ID de uma cidade na API pelo nome e ID do estado.
     * @param {string} cityName - Nome da cidade.
     * @param {number} stateId - ID do estado onde a cidade se localiza.
     * @returns {Promise<number | null>} O ID da cidade ou nulo se não encontrada.
     * @private
     */
    private async getCityIdByNameAndState(cityName: string, stateId: number): Promise<number | null> {
        const token = await this.getAccessToken();
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        try {
            const response = await axios.get<LegalOneCityApiResponse>(`${apiRestUrl}/cities`, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { '$filter': `name eq '${cityName}' and state/id eq ${stateId}`, '$expand': 'state' }
            });
            return response.data.value?.[0]?.id || null;
        } catch {
            return null;
        }
    }

    // --- HELPERS DE CONSTRUÇÃO DE DADOS ---

    /**
     * Constrói o payload para criação/atualização de um contato (pessoa) na API Legal One
     * a partir do modelo de dados interno `User`.
     * @param {User} user - O objeto de usuário do sistema.
     * @returns {Promise<LegalOneCreatePersonPayload>} O payload formatado para a API.
     * @private
     */
    private async buildPersonPayload(user: User): Promise<LegalOneCreatePersonPayload> {
        const DEFAULT_COUNTRY_ID = 1; // ID para "Brasil"
        const DEFAULT_CITY_ID = 1;    // ID para uma cidade padrão, caso a busca falhe

        // Determina o país e busca seu ID
        const countryName = (user.nationality === "Brasileira" || !user.nationality) ? "Brasil" : user.nationality;
        let countryId = await this.getCountryIdByName(countryName) || DEFAULT_COUNTRY_ID;

        // Busca IDs para cidades residencial e comercial
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

        // Monta o payload base
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
                typeId: 1 // Tipo 'Principal'
            }],
            phones: [],
            addresses: [],
        };

        // Adiciona dados opcionais ao payload
        if (user.infoEmail) payload.emails.push({ email: user.infoEmail, isMainEmail: false, isBillingEmail: false, isInvoicingEmail: false, typeId: 2 }); // Tipo 'Outro'
        if (user.cellPhone) payload.phones.push({ number: user.cellPhone, isMainPhone: true, typeId: 1 }); // Tipo 'Celular'
        if (user.phone) payload.phones.push({ number: user.phone, isMainPhone: false, typeId: 2 }); // Tipo 'Residencial'

        // Adiciona endereço residencial se existir
        if (user.residentialCep && user.residentialStreet) {
            payload.addresses?.push({
                type: 'Residential',
                addressLine1: user.residentialStreet,
                addressNumber: user.residentialNumber || 'S/N',
                addressLine2: user.residentialComplement || undefined,
                neighborhood: user.residentialNeighborhood || 'N/A',
                cityId: residentialCityId,
                areaCode: unmask(user.residentialCep), // CEP sem máscara
                isMainAddress: user.correspondenceAddress === 'residential',
                isBillingAddress: !(user.commercialCep && user.commercialStreet), // Faturamento aqui se não houver comercial
                isInvoicingAddress: !(user.commercialCep && user.commercialStreet),
            });
        }
        // Adiciona endereço comercial se existir
        if (user.commercialCep && user.commercialStreet) {
            payload.addresses?.push({
                type: 'Comercial',
                addressLine1: user.commercialStreet,
                addressNumber: user.commercialNumber || 'S/N',
                addressLine2: user.commercialComplement || undefined,
                neighborhood: user.commercialNeighborhood || 'N/A',
                cityId: commercialCityId,
                areaCode: unmask(user.commercialCep), // CEP sem máscara
                isMainAddress: user.correspondenceAddress === 'commercial',
                isBillingAddress: true, // Endereço comercial é sempre de faturamento
                isInvoicingAddress: true,
            });
        }
        return payload;
    }

    /**
     * Atualiza um campo customizado ("Associado") para um contato (PF ou PJ).
     * A API do Legal One possui endpoints e IDs de campos diferentes para pessoas físicas e jurídicas.
     * @param {number} contactId - ID do contato no Legal One.
     * @param {string} associateName - Nome do associado a ser salvo no campo.
     * @param {boolean} isPJ - `true` se o contato for Pessoa Jurídica, `false` se for Pessoa Física.
     * @private
     */
    private async updateAssociateCustomField(contactId: number, associateName: string, isPJ: boolean): Promise<void> {
        const token = await this.getAccessToken();
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;

        // Configuração dinâmica para PF (individuals) ou PJ (companies)
        const endpointType = isPJ ? 'companies' : 'individuals';
        // IDs dos campos customizados "Associado" para PJ e PF, respectivamente
        const ASSOCIATE_FIELD_ID = isPJ ? 3688 : 3706;

        console.log(`[Legal One API] Atualizando Associado (${associateName}) para ID ${contactId} em /${endpointType} (Field ID: ${ASSOCIATE_FIELD_ID})`);

        try {
            // 1. Verifica se o campo customizado já existe para este contato
            const response = await axios.get(`${apiRestUrl}/${endpointType}/${contactId}/customFields`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const customFields = response.data.value || [];
            const existingField = customFields.find((cf: any) => cf.customFieldId === ASSOCIATE_FIELD_ID);

            // 2. Atualiza (PATCH) se existir, ou cria (POST) se não existir
            if (existingField) {
                await axios.patch(`${apiRestUrl}/${endpointType}/${contactId}/customFields/${existingField.id}`, {
                    id: existingField.id,
                    customFieldId: ASSOCIATE_FIELD_ID,
                    textValue: associateName,
                    // Zera outros tipos de valor para garantir consistência
                    booleanValue: null, listItemIdValue: null, contactIdValue: null, dateValue: null, currencyValue: null
                }, { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } });
            } else {
                await axios.post(`${apiRestUrl}/${endpointType}/${contactId}/customFields`, {
                    customFieldId: ASSOCIATE_FIELD_ID,
                    textValue: associateName
                }, { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } });
            }
        } catch (err: any) {
            console.error('[Legal One API] Falha ao atualizar campo customizado "Associado":', err.message);
        }
    }

    // --- MÉTODOS PÚBLICOS DE MANIPULAÇÃO DE CONTATOS ---

    /**
     * Busca um contato na API Legal One pelo CPF ou CNPJ.
     * @param {string} cpfOrCnpj - O CPF ou CNPJ a ser buscado.
     * @returns {Promise<LegalOneContact | null>} O contato encontrado ou nulo.
     */
    public async getContactByCPF(cpfOrCnpj: string): Promise<LegalOneContact | null> {
        const token = await this.getAccessToken();
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;

        const cleanDoc = unmask(cpfOrCnpj);
        const isPJ = cleanDoc.length > 11;
        const endpointType = isPJ ? 'companies' : 'individuals';
        const maskedDoc = maskCPFOrCNPJ(cpfOrCnpj);

        console.log(`[Legal One API] Buscando em /${endpointType} por CPF/CNPJ: ${maskedDoc}`);
        try {
            const response = await axios.get<LegalOnePagedResponse<LegalOneContact>>(`${apiRestUrl}/${endpointType}`, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { '$filter': `identificationNumber eq '${maskedDoc}'`, '$top': 1 }
            });
            if (response.data.value?.length > 0) {
                return response.data.value[0];
            }
            return null;
        } catch (error: any) {
            return null;
        }
    }

    /**
     * Busca os detalhes completos de um contato, incluindo sub-recursos como emails e telefones.
     * @param {number} contactId - ID do contato no Legal One.
     * @param {boolean} isPJ - `true` se for Pessoa Jurídica.
     * @returns {Promise<LegalOneContact>} Os detalhes do contato.
     */
    public async getContactDetails(contactId: number, isPJ: boolean): Promise<LegalOneContact> {
        const token = await this.getAccessToken();
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        const endpointType = isPJ ? 'companies' : 'individuals';

        const response = await axios.get<LegalOneContact>(`${apiRestUrl}/${endpointType}/${contactId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data;
    }

    /**
     * Busca um contato (pessoa física) na API Legal One pelo RG.
     * @param {string} rg - O RG a ser buscado.
     * @returns {Promise<LegalOneContact | null>} O contato encontrado ou nulo.
     */
    public async getContactByRG(rg: string): Promise<LegalOneContact | null> {
        const token = await this.getAccessToken();
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        try {
            const response = await axios.get<LegalOnePagedResponse<LegalOneContact>>(`${apiRestUrl}/individuals`, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { '$filter': `personStateIdentificationNumber eq '${maskRG(rg)}'`, '$top': 1 }
            });
            if (response.data.value?.length > 0) {
                return response.data.value[0];
            }
            return null;
        } catch {
            return null;
        }
    }

    /**
     * Cria um novo contato (PF ou PJ) na API Legal One.
     * @param {User} user - O objeto de usuário com os dados para criação.
     * @param {string} [associateName] - Nome do associado para preencher o campo customizado.
     * @returns {Promise<LegalOneContact>} O contato recém-criado.
     */
    public async createContact(user: User, associateName?: string): Promise<LegalOneContact> {
        const token = await this.getAccessToken();
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;

        const cleanDoc = user.cpfOrCnpj ? unmask(user.cpfOrCnpj) : '';
        const isPJ = cleanDoc.length > 11;
        const endpointType = isPJ ? 'companies' : 'individuals';

        const payload = await this.buildPersonPayload(user);

        try {
            const response = await axios.post<LegalOneContact>(`${apiRestUrl}/${endpointType}`, payload, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const newContact = response.data;

            // Se um nome de associado foi fornecido, atualiza o campo customizado
            if (associateName) {
                await this.updateAssociateCustomField(newContact.id, associateName, isPJ);
            }
            return newContact;
        } catch (error: any) {
            if (error.response?.data) {
                console.log('[Legal One API] Erro ao criar contato:', JSON.stringify(error.response.data));
            }
            throw new Error("Erro ao criar contato no Legal One.");
        }
    }

    /**
     * Atualiza um contato existente no Legal One.
     * O processo é feito em etapas:
     * 1. Atualiza os dados básicos do contato (PATCH no recurso raiz).
     * 2. Atualiza o campo customizado "Associado", se informado.
     * 3. Busca os detalhes atuais do contato para obter os IDs de e-mails, telefones e endereços.
     * 4. Compara os dados novos com os existentes e aplica PATCH (atualização) ou POST (criação) para cada sub-recurso.
     * @param {number} contactId - ID do contato a ser atualizado.
     * @param {User} user - Objeto com os novos dados do usuário.
     * @param {string} [associateName] - Novo nome do associado para o campo customizado.
     */
    public async updateContact(contactId: number, user: User, associateName?: string): Promise<void> {
        const token = await this.getAccessToken();
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;

        const cleanDoc = user.cpfOrCnpj ? unmask(user.cpfOrCnpj) : '';
        const isPJ = cleanDoc.length > 11;
        const endpointType = isPJ ? 'companies' : 'individuals';

        console.log(`[Legal One API] Iniciando atualização do ID ${contactId} em /${endpointType}`);
        const newPayload = await this.buildPersonPayload(user) as any;

        // 1. Atualiza os dados da raiz do contato (exceto listas como emails, phones, etc.)
        const { country, emails, phones, addresses, ...basicPayload } = newPayload;
        try {
            await axios.patch(`${apiRestUrl}/${endpointType}/${contactId}`, basicPayload, {
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
            });
        } catch (e: any) {
            console.error('Erro ao atualizar dados raiz do contato:', e.message);
        }

        // Atualiza o campo customizado, se fornecido
        if (associateName) {
            await this.updateAssociateCustomField(contactId, associateName, isPJ);
        }

        // 2. Busca os detalhes atuais do contato para obter os IDs dos sub-recursos
        let currentContact: LegalOneContact;
        try {
            currentContact = await this.getContactDetails(contactId, isPJ);
        } catch {
            console.error(`Não foi possível obter detalhes do contato ${contactId} para concluir a atualização.`);
            return;
        }

        // 3. Atualiza E-MAILS (cria ou modifica o e-mail principal)
        const newMainEmail = newPayload.emails.find((e: any) => e.isMainEmail);
        if (newMainEmail) {
            const currentMainEmail = currentContact.emails?.find(e => e.isMainEmail) || currentContact.emails?.[0];
            try {
                if (currentMainEmail) {
                    // Modifica o e-mail principal existente
                    await axios.patch(`${apiRestUrl}/${endpointType}/${contactId}/emails/${currentMainEmail.id}`, { ...newMainEmail, id: currentMainEmail.id }, { headers: { 'Authorization': `Bearer ${token}` } });
                } else {
                    // Cria um novo e-mail principal se não houver nenhum
                    await axios.post(`${apiRestUrl}/${endpointType}/${contactId}/emails`, newMainEmail, { headers: { 'Authorization': `Bearer ${token}` } });
                }
                console.log('E-mail principal atualizado/criado com sucesso.');
            } catch (e: any) {
                console.error('Erro ao processar e-mail:', e.message);
            }
        }

        // 4. Atualiza TELEFONES (cria ou modifica o telefone principal)
        const newMainPhone = newPayload.phones.find((p: any) => p.isMainPhone);
        if (newMainPhone) {
            const currentMainPhone = currentContact.phones?.find(p => p.isMainPhone) || currentContact.phones?.[0];
            try {
                if (currentMainPhone) {
                    // Modifica o telefone principal existente
                    await axios.patch(`${apiRestUrl}/${endpointType}/${contactId}/phones/${currentMainPhone.id}`, { ...newMainPhone, id: currentMainPhone.id }, { headers: { 'Authorization': `Bearer ${token}` } });
                } else {
                    // Cria um novo telefone principal se não houver nenhum
                    await axios.post(`${apiRestUrl}/${endpointType}/${contactId}/phones`, newMainPhone, { headers: { 'Authorization': `Bearer ${token}` } });
                }
                console.log('Telefone principal atualizado/criado com sucesso.');
            } catch (e: any) {
                console.error('Erro ao processar telefone:', e.message);
            }
        }

        // 5. Atualiza ENDEREÇOS (cria ou modifica com base no tipo)
        if (newPayload.addresses && newPayload.addresses.length > 0) {
            try {
                // Busca os endereços já existentes para obter seus IDs
                const addrResponse = await axios.get<LegalOnePagedResponse<LegalOneAddress>>(`${apiRestUrl}/${endpointType}/${contactId}/addresses`, { headers: { 'Authorization': `Bearer ${token}` } });
                const existingAddresses = addrResponse.data.value || [];

                for (const newAddr of newPayload.addresses) {
                    // Tenta encontrar um endereço correspondente para atualizar
                    // A lógica prioriza o endereço principal ou o tipo (Residencial/Comercial)
                    let match = newAddr.isMainAddress
                        ? existingAddresses.find(a => a.isMainAddress)
                        : existingAddresses.find(a => !a.isMainAddress && a.type === newAddr.type);

                    if (match) {
                        // Endereço encontrado, atualiza com PATCH
                        await axios.patch(`${apiRestUrl}/${endpointType}/${contactId}/addresses/${match.id}`, { ...newAddr, id: match.id }, { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } });
                    } else {
                        // Nenhum endereço correspondente, cria um novo com POST
                        await axios.post(`${apiRestUrl}/${endpointType}/${contactId}/addresses`, newAddr, { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } });
                    }
                }
                console.log('Endereços processados com sucesso.');
            } catch (e: any) {
                console.error('Erro ao processar endereços:', e.message);
            }
        }
    }

    // --- MÉTODOS DE MANIPULAÇÃO DE DOCUMENTOS ---

    /**
     * Solicita um "container" de upload temporário da API Legal One.
     * Este é o primeiro passo para enviar um arquivo.
     * @param {string} fileExtension - A extensão do arquivo (ex: 'pdf', 'docx').
     * @returns {Promise<LegalOneUploadContainer>} Objeto com a URL do container e o nome do arquivo a ser usado.
     */
    public async getUploadContainer(fileExtension: string): Promise<LegalOneUploadContainer> {
        const token = await this.getAccessToken();
        const url = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest/documents/getcontainer(fileExtension='${fileExtension}')`;
        const response = await axios.get<LegalOneUploadContainer>(url, { headers: { 'Authorization': `Bearer ${token}` } });
        return response.data;
    }

    /**
     * Envia o buffer de um arquivo para a URL do container de upload fornecida pela API.
     * @param {string} containerUrl - A URL segura retornada por `getUploadContainer`.
     * @param {Buffer} fileBuffer - O conteúdo do arquivo em formato de buffer.
     * @param {string} mimeType - O tipo MIME do arquivo (ex: 'application/pdf').
     */
    public async uploadFileToContainer(containerUrl: string, fileBuffer: Buffer, mimeType: string): Promise<void> {
        await axios.put(containerUrl, fileBuffer, {
            headers: {
                'x-ms-blob-type': 'BlockBlob',
                'Content-Type': mimeType
            }
        });
    }

    /**
     * Finaliza o processo de upload, associando o arquivo enviado ao container a um contato específico no Legal One.
     * @param {string} fileNameInContainer - O nome do arquivo no container (retornado por `getUploadContainer`).
     * @param {string} originalFileName - O nome original do arquivo, para referência.
     * @param {number} contactId - O ID do contato ao qual o documento será associado.
     */
    public async finalizeDocument(fileNameInContainer: string, originalFileName: string, contactId: number): Promise<void> {
        const token = await this.getAccessToken();
        const payload: LegalOneDocumentPayload = {
            archive: originalFileName,
            description: `#SM ${originalFileName}`, // Prefixo para identificar a origem
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
            relationships: [{
                Link: 'Contact',
                LinkItem: { Id: contactId, Description: originalFileName }
            }]
        };
        await axios.post(`${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest/Documents`, payload, {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
    }

    // --- MÉTODOS DE CONSULTA DE PROCESSOS E ANDAMENTOS ---

    /**
     * Busca os detalhes de um processo judicial pelo seu número.
     * Tenta buscar pelo número formatado e, se falhar, pelo número sem formatação.
     * @param {string} processNumber - O número do processo.
     * @returns {Promise<LegalOneLawsuit>} Os detalhes do processo.
     */
     // ============================================================================
    //  NOVO HELPER: BUSCAR PARTICIPANTES (Genérico)
    // ============================================================================
    private async getEntityParticipants(endpointType: 'lawsuits' | 'appeals' | 'proceduralissues', entityId: number): Promise<LegalOneParticipant[]> {
        const token = await this.getAccessToken();
        const apiRestUrl = `${process.env.LEGAL_ONE_API_BASE_URL}/v1/api/rest`;
        const url = `${apiRestUrl}/${endpointType}/${entityId}/participants`;
        
        console.log(`[Legal One API] Buscando participantes em: ${endpointType}/${entityId}`);
        
        try {
            // Nota: O retorno é { value: [...] }
            const response = await axios.get<{ value: LegalOneParticipant[] }>(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const parts = response.data.value || [];
            console.log(`[Legal One API] ${parts.length} participantes encontrados.`);
            return parts;
        } catch (error: any) {
            console.warn(`[Legal One API] Falha ao buscar participantes para ${endpointType}/${entityId}:`, error.message);
            return [];
        }
    }

    // ============================================================================
    //  BUSCAS DE PROCESSO (ATUALIZADAS COM A LÓGICA DE 3 ETAPAS)
    // ============================================================================

    public async getProcessDetails(processNumber: string): Promise<LegalOneLawsuit> {
        const token = await this.getAccessToken();
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
        } catch (e) {}

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
                } catch (e) {}
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
        } catch (e) {}

        if (!appeal) throw new Error("Recurso não encontrado");

        // 2. Detalhes (courtPanel)
        try {
            const details = await axios.get<LegalOneAppeal>(`${requestUrl}/${appeal.id}`, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { '$expand': 'courtPanel' }
            });
            appeal = details.data;
        } catch (e) {}

        // 3. Participantes
        const participants = await this.getEntityParticipants('appeals', appeal.id);
        appeal.participants = participants;

        return appeal;
    }

    public async getProceduralIssueDetails(processNumber: string): Promise<LegalOneProceduralIssue> {
        const token = await this.getAccessToken();
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
        } catch (e) {}

        if (!issue) throw new Error("Incidente não encontrado");

        // 2. Detalhes
        try {
             const details = await axios.get<LegalOneProceduralIssue>(`${requestUrl}/${issue.id}`, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: { '$expand': 'courtPanel' }
            });
            issue = details.data;
        } catch (e) {}

        // 3. Participantes
        const participants = await this.getEntityParticipants('proceduralissues', issue.id);
        issue.participants = participants;

        return issue;
    }

    /**
     * Busca todos os andamentos (atualizações) manuais associados a uma entidade (processo, recurso, etc.).
     * A função lida com a paginação da API para retornar todos os resultados.
     * @param {number} entityId - O ID da entidade no Legal One.
     * @returns {Promise<LegalOneUpdate[]>} Uma lista de todos os andamentos.
     */
    public async getProcessUpdates(entityId: number): Promise<LegalOneUpdate[]> {
        const token = await this.getAccessToken();
        let allUpdates: LegalOneUpdate[] = [];
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
}

// Exporta uma instância única (singleton) do serviço
export const legalOneApiService = new LegalOneApiService();