/**
 * legalOneApiService.ts — Facade de Integração com o Legal One
 *
 * Centraliza todo o acesso à API externa do Legal One através de um único
 * objeto singleton (`legalOneApiService`). Internamente delega para três
 * módulos especializados, mantendo a responsabilidade de cada um isolada:
 *
 * | Módulo              | Responsabilidade                                     |
 * |---------------------|------------------------------------------------------|
 * | LegalOneContacts    | CRUD de contatos (PF/PJ) — busca por CPF, RG, etc. |
 * | LegalOneProcesses   | Processos, recursos, incidentes, andamentos, pastas |
 * | LegalOneDocuments   | GED: listagem, download, upload e finalização       |
 *
 * ## Por que Facade?
 * Usar a classe de cada domínio diretamente espalharia os imports por todo o
 * código. O Facade agrupa as operações em um objeto único, facilitando mocks
 * em testes (`jest.mock('../../services/legalOneApiService', ...)`) e
 * permitindo que a implementação interna seja trocada sem impactar os callers.
 *
 * ## Uso
 * ```typescript
 * import { legalOneApiService } from '../services/legalOneApiService';
 * const contato = await legalOneApiService.getContactByCPF('123.456.789-00');
 * ```
 */

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
    public listLawsuits = this.processes.listLawsuits.bind(this.processes);
    public getAppealsByLawsuitId = this.processes.getAppealsByLawsuitId.bind(this.processes);
    public getProceduralIssuesByLawsuitId = this.processes.getProceduralIssuesByLawsuitId.bind(this.processes);
    public getEntityParticipants = this.processes.getEntityParticipants.bind(this.processes);
    public getEntitiesByFolderCode = this.processes.getEntitiesByFolderCode.bind(this.processes);
    public getAllByProcessNumber = this.processes.getAllByProcessNumber.bind(this.processes);
    public getLawsuitById = this.processes.getLawsuitById.bind(this.processes);
    public getAppealById = this.processes.getAppealById.bind(this.processes);
    public getProceduralIssueById = this.processes.getProceduralIssueById.bind(this.processes);



    // --- Documentos ---
    public getProcessDocuments = this.documents.getProcessDocuments.bind(this.documents);
    public getDocumentDownloadUrl = this.documents.getDocumentDownloadUrl.bind(this.documents);
    public getUploadContainer = this.documents.getUploadContainer.bind(this.documents);
    public uploadFileToContainer = this.documents.uploadFileToContainer.bind(this.documents);
    public finalizeDocument = this.documents.finalizeDocument.bind(this.documents);
}

export const legalOneApiService = new LegalOneApiService();