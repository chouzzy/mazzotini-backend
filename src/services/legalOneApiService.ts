import { LegalOneContacts } from "./LegalOne/LegalOneContacts";
import { LegalOneDocuments } from "./LegalOne/LegalOneDocuments";
import { LegalOneProcesses } from "./LegalOne/LegalOneProcesses";

/**
 * Facade (Fachada) do Serviço Legal One.
 * Agrupa os módulos especializados (Contatos, Processos, Documentos) numa única interface
 * para manter compatibilidade com o resto da aplicação.
 */
class LegalOneApiService {
    // Instancia os sub-serviços
    private contacts = new LegalOneContacts();
    private processes = new LegalOneProcesses();
    private documents = new LegalOneDocuments();

    // =================================================================
    //  DELEGAÇÃO DE MÉTODOS (Binding)
    // =================================================================
    
    // --- Contatos (PF/PJ) ---
    public createContact = this.contacts.createContact.bind(this.contacts);
    public updateContact = this.contacts.updateContact.bind(this.contacts);
    public getContactByCPF = this.contacts.getContactByCPF.bind(this.contacts);
    public getContactByRG = this.contacts.getContactByRG.bind(this.contacts);
    public getContactDetails = this.contacts.getContactDetails.bind(this.contacts);

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

// Exporta a instância singleton, mantendo a compatibilidade com o código existente
export const legalOneApiService = new LegalOneApiService();