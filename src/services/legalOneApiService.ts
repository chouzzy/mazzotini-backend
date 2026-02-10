import { LegalOneContacts } from './LegalOne/LegalOneContacts';
import { LegalOneProcesses } from './LegalOne/LegalOneProcesses';
import { LegalOneDocuments } from './LegalOne/LegalOneDocuments';

class LegalOneApiService {
    private contacts = new LegalOneContacts();
    private processes = new LegalOneProcesses();
    private documents = new LegalOneDocuments();

    // --- Contatos (PF/PJ) ---
    public createContact = this.contacts.createContact.bind(this.contacts);
    public updateContact = this.contacts.updateContact.bind(this.contacts);
    public getContactByCPF = this.contacts.getContactByCPF.bind(this.contacts);
    public getContactByRG = this.contacts.getContactByRG.bind(this.contacts);
    public getContactDetails = this.contacts.getContactDetails.bind(this.contacts); // Busca específica (PF/PJ)
    
    // NOVO: Busca Genérica
    public getContactGeneric = this.contacts.getContactGeneric.bind(this.contacts);

    // --- Processos e Andamentos ---
    public getProcessDetails = this.processes.getProcessDetails.bind(this.processes);
    public getAppealDetails = this.processes.getAppealDetails.bind(this.processes);
    public getProceduralIssueDetails = this.processes.getProceduralIssueDetails.bind(this.processes);
    public getProcessUpdates = this.processes.getProcessUpdates.bind(this.processes);

    // --- Documentos ---
    public getProcessDocuments = this.documents.getProcessDocuments.bind(this.documents);
    public getDocumentDownloadUrl = this.documents.getDocumentDownloadUrl.bind(this.documents);
    public getUploadContainer = this.documents.getUploadContainer.bind(this.documents);
    public uploadFileToContainer = this.documents.uploadFileToContainer.bind(this.documents);
    public finalizeDocument = this.documents.finalizeDocument.bind(this.documents);
}

export const legalOneApiService = new LegalOneApiService();