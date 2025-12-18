// ============================================================================
//  INTERFACES GERAIS DE RESPOSTA E ENTIDADES
// ============================================================================

/**
 * Representa uma resposta paginada genérica da API Legal One.
 * @template T O tipo dos itens na lista de valores.
 */
export interface LegalOnePagedResponse<T> {
    /** Link para a próxima página de resultados, se houver. */
    '@odata.nextLink'?: string;
    /** Array contendo os resultados da página atual. */
    value: T[];
}

/**
 * Define um participante em um processo, recurso ou incidente processual.
 */
export interface LegalOneParticipant {
    /** Tipo do participante no processo. */
    type: "Customer" | "PersonInCharge" | "OtherParty" | "Party" | "Other" | "LawyerOfOtherParty" | "Requester";
    /** ID do contato associado a este participante. */
    contactId: number;
    /** Nome do contato (opcional). */
    contactName?: string;
    /** Indica se este é o participante principal. */
    isMainParticipant?: boolean;
}

/**
 * Representa um processo judicial no sistema Legal One.
 */
export interface LegalOneLawsuit {
    id: number;
    folder: string;
    title: string;
    identifierNumber: string;
    otherNumber?: string | null;
    participants: LegalOneParticipant[];
    courtPanel?: { id: number; description: string };
    courtPanelNumberText?: string;
}

/**
 * Representa a resposta da API para uma consulta de processos judiciais.
 */
export interface LegalOneLawsuitApiResponse {
    value: LegalOneLawsuit[];
}

/**
 * Representa um recurso (apelação) no sistema Legal One.
 */
export interface LegalOneAppeal {
    id: number;
    folder: string;
    title: string;
    identifierNumber: string;
    otherNumber?: string | null;
    participants: LegalOneParticipant[];
    courtPanel?: { id: number; description: string };
    courtPanelNumberText?: string;
    relatedLitigationType?: 'Lawsuit' | string;
    relatedLitigationId?: number;
}

/**
 * Representa a resposta da API para uma consulta de recursos.
 */
export interface LegalOneAppealApiResponse {
    value: LegalOneAppeal[];
}

/**
 * Representa um incidente processual no sistema Legal One.
 */
export interface LegalOneProceduralIssue {
    id: number;
    title: string;
    identifierNumber: string;
    otherNumber?: string | null;
    participants: LegalOneParticipant[];
    courtPanel?: { id: number; description: string };
    courtPanelNumberText?: string;
    relatedLitigationId?: number;
    relatedLitigationType?: 'Lawsuit' | string;
}

/**
 * Representa a resposta da API para uma consulta de incidentes processuais.
 */
export interface LegalOneProceduralIssueApiResponse {
    value: LegalOneProceduralIssue[];
}


// ============================================================================
//  INTERFACES DE CONTATOS (INDIVÍDUOS E EMPRESAS)
// ============================================================================

/**
 * Representa um e-mail associado a um contato.
 */
export interface LegalOneEmail {
    id: number;
    email: string;
    typeId: number;
    isMainEmail: boolean;
}

/**
 * Representa um endereço associado a um contato.
 */
export interface LegalOneAddress {
    id: number;
    type: string;
    addressLine1: string;
    addressNumber: string;
    cityId: number;
    isMainAddress: boolean;
}

/**
 * Representa um telefone associado a um contato.
 */
export interface LegalOnePhone {
    id: number;
    number: string;
    typeId: number;
    isMainPhone: boolean;
}

/**
 * Representa um contato unificado, que pode ser uma pessoa física ou jurídica.
 */
export interface LegalOneContact {
    id: number;
    /** Nome (PF) ou Razão Social (PJ). */
    name: string;
    /** Nome Fantasia (apenas para PJ). */
    tradeName?: string;
    /** E-mail principal do contato. */
    email?: string;
    /** CPF (PF) ou CNPJ (PJ). */
    identificationNumber?: string;
    /** RG (apenas para PF). */
    personStateIdentificationNumber?: string;
    /** Lista detalhada de e-mails. */
    emails?: LegalOneEmail[];
    /** Lista detalhada de endereços. */
    addresses?: LegalOneAddress[];
    /** Lista detalhada de telefones. */
    phones?: LegalOnePhone[];
}

/**
 * Define o payload para a criação de um novo contato (pessoa física ou jurídica).
 */
export interface LegalOneCreatePersonPayload {
    /** Nome (PF) ou Razão Social (PJ). */
    name: string;
    /** Nome Fantasia (para PJ). */
    tradeName?: string;
    /** CPF ou CNPJ. */
    identificationNumber?: string;
    /** RG. */
    personStateIdentificationNumber?: string;
    /** País do contato. */
    country?: { id: number };
    /** Data de nascimento (formato YYYY-MM-DD). */
    birthDate?: string;
    /** Gênero. */
    gender?: 'Male' | 'Female';
    /** Nacionalidade. */
    nacionality?: string;
    /** Lista de e-mails a serem criados. */
    emails: any[]; // TODO: Tipar corretamente se a estrutura for conhecida
    /** Lista de telefones a serem criados. */
    phones: any[]; // TODO: Tipar corretamente se a estrutura for conhecida
    /** Lista de endereços a serem criados. */
    addresses: any[]; // TODO: Tipar corretamente se a estrutura for conhecida
}


// ============================================================================
//  OUTRAS INTERFACES (ANDAMENTOS, DOCUMENTOS, LOOKUPS)
// ============================================================================

/**
 * Representa um andamento (atualização) de um processo.
 */
export interface LegalOneUpdate {
    id: number;
    description: string;
    notes: string | null;
    date: string;
    typeId: number;
    originType: 'Manual' | 'OfficialJournalsCrawler' | string;
}

/**
 * Resposta da API para uma consulta de andamentos.
 */
export interface LegalOneUpdatesApiResponse extends LegalOnePagedResponse<LegalOneUpdate> {}

/**
 * Representa um documento no sistema.
 */
export interface LegalOneDocument {
    id: number;
    archive: string;
    type: string;
}

/**
 * Resposta da API para uma consulta de documentos.
 */
export interface LegalOneDocumentsApiResponse {
    value: LegalOneDocument[];
}

/**
 * Contém a URL para download de um documento.
 */
export interface LegalOneDocumentDownload {
    id: number;
    url: string;
}

/**
 * Informações do container de upload de um arquivo.
 */
export interface LegalOneUploadContainer {
    id: number;
    fileName: string;
    externalId: string;
    uploadedFileSize: number;
}

/**
 * Payload para criação de um novo documento.
 */
export interface LegalOneDocumentPayload {
    archive: string;
    fileName: string;
    description: string;
    generateUrlDownload: string;
    repository: string;
    typeId: string | null;
    author: string | null;
    type: string;
    isPhysicallyStored: boolean | null;
    isModel: boolean | null;
    fileUploader: string | null;
    beginDate: string | null;
    endDate: string | null;
    notes: string | null;
    phisicalLocalization: string | null;
    relationships: {
        Link: 'Contact';
        LinkItem: {
            Id: number;
            Description: string;
        };
    }[];
}

/**
 * Representa um estado (UF).
 */
export interface LegalOneState {
    id: number;
    name: string;
    stateCode: string;
}

/**
 * Resposta da API para consulta de estados.
 */
export interface LegalOneStateApiResponse {
    value: LegalOneState[];
}

/**
 * Representa um país.
 */
export interface LegalOneCountry {
    id: number;
    name: string;
}

/**
 * Resposta da API para consulta de países.
 */
export interface LegalOneCountryApiResponse extends LegalOnePagedResponse<LegalOneCountry> {}

/**
 * Representa uma cidade.
 */
export interface LegalOneCity {
    id: number;
    name: string;
    state: {
        id: number;
        stateCode: string;
    };
}

/**
 * Resposta da API para consulta de cidades.
 */
export interface LegalOneCityApiResponse extends LegalOnePagedResponse<LegalOneCity> {}