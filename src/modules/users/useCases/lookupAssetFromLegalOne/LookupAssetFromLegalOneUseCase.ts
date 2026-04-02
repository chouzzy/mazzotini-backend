import {
    legalOneApiService
} from "../../../../services/legalOneApiService";
import { syncParticipantsAsUsers } from "../../../../utils/participantHelper";

interface ILegalOneMatch {
    legalOneId: number;
    folderCode: string;
    legalOneType: string;
}

interface ILookupResult {
    processNumber: string;
    originalCreditor: string;
    origemProcesso: string;
    legalOneId: number;
    legalOneType: 'Lawsuit' | 'Appeal' | 'ProceduralIssue';
    otherParty?: string;
    nickname?: string;
    processFolderId?: string;
    suggestedInvestors?: { userId: string; share: number }[];
    // Todas as entradas deste número de processo no Legal One (pode haver mais de uma pasta)
    legalOneMatches: ILegalOneMatch[];
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

        const processNumber = processData.identifierNumber || processData.oldNumber || '';

        // Busca no Legal One todas as entradas com este número de processo
        // (pode haver múltiplas pastas para o mesmo número judicial)
        const legalOneMatches: ILegalOneMatch[] = processNumber
            ? (await legalOneApiService.getAllByProcessNumber(processNumber)).map(m => ({
                legalOneId: m.id,
                folderCode: m.folder,
                legalOneType: m.legalOneType,
              }))
            : [];

        return {
            processNumber,
            originalCreditor,
            origemProcesso,
            legalOneId: processData.id,
            legalOneType: entityType,
            otherParty,
            nickname,
            processFolderId,
            suggestedInvestors,
            legalOneMatches,
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

    async executeByFolder(folderCode: string): Promise<ILookupResult> {
        console.log(`[Lookup Asset] Buscando por pasta: ${folderCode}`);

        const entities = await legalOneApiService.getEntitiesByFolderCode(folderCode);

        if (entities.length === 0) {
            throw new Error(`Nenhum processo encontrado para a pasta: ${folderCode}`);
        }

        // Pega o primeiro resultado (a pasta tem um processo específico)
        const entity = entities[0];
        const entityType = entity.__legalOneType as 'Lawsuit' | 'Appeal' | 'ProceduralIssue';

        // Busca participantes do processo encontrado
        const endpointType = entityType === 'Lawsuit' ? 'lawsuits'
            : entityType === 'Appeal' ? 'appeals'
            : 'proceduralissues';

        const participants = await legalOneApiService.getEntityParticipants(endpointType, entity.id).catch(() => []);
        entity.participants = participants;

        const syncedUsers = await syncParticipantsAsUsers(participants);

        return this.extractData(entity, entityType, syncedUsers);
    }
}

export { LookupAssetFromLegalOneUseCase };