import { 
    legalOneApiService 
} from "../../../../services/legalOneApiService";
import { syncParticipantsAsUsers } from "../../../../utils/participantHelper";

// CORREÇÃO: Adicionado o campo opcional na interface
interface ILookupResult {
    originalCreditor: string;
    origemProcesso: string;
    legalOneId: number;
    legalOneType: 'Lawsuit' | 'Appeal' | 'ProceduralIssue';
    otherParty?: string;
    nickname?: string;
    processFolderId?: string;
    suggestedInvestors?: { userId: string; share: number }[]; // <--- O CAMPO QUE FALTAVA
}

class LookupAssetFromLegalOneUseCase {

    private async extractData(
        processData: any,
        entityType: 'Lawsuit' | 'Appeal' | 'ProceduralIssue',
        syncedUsers: any[] = [] 
    ): Promise<ILookupResult> {
        
        console.log('[extractData] Iniciando extração de dados...');
        
        let participants = processData.participants || [];
        if (participants.value) participants = participants.value;
        if (!Array.isArray(participants)) participants = [];

        const customer = participants.find((p: any) => p.type === "Customer");
        const originalCreditor = customer ? customer.contactName : "Credor não identificado";
        
        const otherPartyObj = participants.find((p: any) => p.type === "OtherParty" && p.isMainParticipant) 
                        || participants.find((p: any) => p.type === "OtherParty");
        const otherParty = otherPartyObj ? otherPartyObj.contactName : undefined;
        const nickname = otherParty;

        let origemProcesso = processData.title || "Origem não identificada"; 
        if (processData.courtPanel) {
            origemProcesso = processData.courtPanelNumberText 
                ? `${processData.courtPanelNumberText} ${processData.courtPanel.description}`
                : processData.courtPanel.description;
        }

        let processFolderId: string | undefined = undefined;
        if (processData.folder) {
            const { ensureProcessFolderExists } = require("../../../../utils/folderHelper");
            processFolderId = await ensureProcessFolderExists(processData.folder, processData.title) || undefined;
        }

        // Monta a sugestão de investidores
        const suggestedInvestors = syncedUsers.map(u => ({
            userId: u.id,
            share: 0 
        }));

        if (suggestedInvestors.length === 1) suggestedInvestors[0].share = 100;

        return {
            originalCreditor,
            origemProcesso,
            legalOneId: processData.id,
            legalOneType: entityType,
            otherParty,
            nickname,
            processFolderId,
            suggestedInvestors // <--- Retornando
        };
    }

    async execute(processNumber: string): Promise<ILookupResult> {
        console.log(`[Lookup Asset] Buscando e Sincronizando: ${processNumber}`);
        let syncedUsers: any[] = [];

        try {
            const lawsuitData = await legalOneApiService.getProcessDetails(processNumber);
            if (lawsuitData.participants) {
                syncedUsers = await syncParticipantsAsUsers(lawsuitData.participants);
            }
            return this.extractData(lawsuitData, 'Lawsuit', syncedUsers);

        } catch (lawsuitError: any) {
            try {
                const appealData = await legalOneApiService.getAppealDetails(processNumber);
                if (appealData.participants) {
                    syncedUsers = await syncParticipantsAsUsers(appealData.participants);
                }
                return this.extractData(appealData, 'Appeal', syncedUsers);

            } catch (appealError: any) {
                try {
                    const issueData = await legalOneApiService.getProceduralIssueDetails(processNumber);
                    if (issueData.participants) {
                        syncedUsers = await syncParticipantsAsUsers(issueData.participants);
                    }
                    return this.extractData(issueData, 'ProceduralIssue', syncedUsers);

                } catch (issueError: any) {
                    throw new Error(`Processo ${processNumber} não encontrado.`);
                }
            }
        }
    }
}

export { LookupAssetFromLegalOneUseCase };