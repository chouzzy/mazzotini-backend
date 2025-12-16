// ============================================================================
//  INTERFACES GERAIS
// ============================================================================

export interface LegalOnePagedResponse<T> {
    '@odata.nextLink'?: string;
    value: T[];
}

export interface LegalOneParticipant {
    type: "Customer" | "PersonInCharge" | "OtherParty" | "Party" | "Other" | "LawyerOfOtherParty" | "Requester";
    contactId: number;
    contactName?: string;
    isMainParticipant?: boolean;
}

// ============================================================================
//  INTERFACES DE PROCESSOS (Lawsuits)
// ============================================================================

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

export interface LegalOneLawsuitApiResponse {
    value: LegalOneLawsuit[];
}

// ============================================================================
//  INTERFACES DE RECURSOS (Appeals)
// ============================================================================

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

export interface LegalOneAppealApiResponse {
    value: LegalOneAppeal[];
}

// ============================================================================
//  INTERFACES DE INCIDENTES (Procedural Issues)
// ============================================================================

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

export interface LegalOneProceduralIssueApiResponse {
    value: LegalOneProceduralIssue[];
}

// ============================================================================
//  INTERFACES DE CONTATOS (Individuals)
// ============================================================================

export interface LegalOneEmail {
    id: number;
    email: string;
    typeId: number;
    isMainEmail: boolean;
}

export interface LegalOneAddress {
    id: number;
    type: string;
    addressLine1: string;
    addressNumber: string;
    cityId: number;
    isMainAddress: boolean;
}

export interface LegalOnePhone {
    id: number;
    number: string;
    typeId: number;
    isMainPhone: boolean;
}

export interface LegalOneContact {
    id: number;
    name: string;
    email?: string;
    identificationNumber?: string;        // CPF/CNPJ
    personStateIdentificationNumber?: string; // RG
    emails?: LegalOneEmail[];
    addresses?: LegalOneAddress[];
    phones?: LegalOnePhone[];
}

// Payload usado para Criar (POST) e Atualizar (PATCH - parcial)
export interface LegalOneCreatePersonPayload {
    name: string;
    identificationNumber?: string;
    personStateIdentificationNumber?: string;
    country?: { id: number };
    birthDate?: string;
    gender?: 'Male' | 'Female';
    nacionality?: string;
    
    emails: any[];
    phones: any[];
    addresses: any[];
}

// ============================================================================
//  INTERFACES DE ANDAMENTOS (Updates)
// ============================================================================

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
    '@odata.nextLink'?: string;
}

// ============================================================================
//  INTERFACES DE DOCUMENTOS
// ============================================================================

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

export interface LegalOneUploadContainer {
    id: number;
    fileName: string;
    externalId: string;
    uploadedFileSize: number;
}

export interface LegalOneDocumentPayload {
    archive: string;
    fileName: string;
    description: string;
    generateUrlDownload: string;
    typeId: string | null;
    author: string | null;
    type: string;
    repository: string | null;
    isPhysicallyStored: boolean | null;
    isModel: boolean | null;
    fileUploader: string | null;
    beginDate: string | null;
    endDate: string | null;
    notes: string | null;
    phisicalLocalization: string | null;
    relationships: {
        Link: 'Contact';
        LinkItem: { Id: number; Description: string };
    }[];
}

// ============================================================================
//  INTERFACES DE LOOKUP (Geografia)
// ============================================================================

export interface LegalOneState { id: number; name: string; stateCode: string; }
export interface LegalOneStateApiResponse { value: LegalOneState[]; }

export interface LegalOneCountry { id: number; name: string; }
export interface LegalOneCountryApiResponse { '@odata.nextLink'?: string; value: LegalOneCountry[]; }

export interface LegalOneCity { id: number; name: string; state: { id: number; stateCode: string; }; }
export interface LegalOneCityApiResponse { '@odata.nextLink'?: string; value: LegalOneCity[]; }