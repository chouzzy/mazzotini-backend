import { 
    legalOneApiService 
} from "../../../../services/legalOneApiService";

interface ILookupResult {
    originalCreditor: string;
    origemProcesso: string;
    legalOneId: number;
    legalOneType: 'Lawsuit' | 'Appeal' | 'ProceduralIssue';
    otherParty?: string; // <--- NOVO CAMPO: Parte Contrária Oficial
}

class LookupAssetFromLegalOneUseCase {

    private extractData(
        processData: any,
        entityType: 'Lawsuit' | 'Appeal' | 'ProceduralIssue'
    ): ILookupResult {

        console.log('[extractData] Iniciando extração de dados...');
        
        let participants = processData.participants;
        if (!participants) {
            participants = [];
        } else if (participants.value && Array.isArray(participants.value)) {
            participants = participants.value;
        } else if (!Array.isArray(participants)) {
            participants = [];
        }
        
        // 1. Credor Original (Customer)
        const customer = participants.find((p: any) => p.type === "Customer");
        const originalCreditor = customer ? customer.contactName : "Credor não identificado";
        
        // 2. Parte Contrária (OtherParty)
        // Prioriza o participante principal (isMainParticipant)
        const otherPartyObj = participants.find((p: any) => p.type === "OtherParty" && p.isMainParticipant) 
                        || participants.find((p: any) => p.type === "OtherParty");
                        
        const otherParty = otherPartyObj ? otherPartyObj.contactName : undefined;

        // 3. Origem
        let origemProcesso = processData.title || "Origem não identificada"; 
        if (processData.courtPanel && processData.courtPanelNumberText) {
            origemProcesso = `${processData.courtPanelNumberText} ${processData.courtPanel.description}`;
        } else if (processData.courtPanel) {
            origemProcesso = processData.courtPanel.description;
        }

        console.log(`[Lookup] Credor: ${originalCreditor}, Parte Contrária: ${otherParty}`);

        return {
            originalCreditor,
            origemProcesso,
            legalOneId: processData.id,
            legalOneType: entityType,
            otherParty // <--- Agora mapeamos para o campo correto
        };
    }

    async execute(processNumber: string): Promise<ILookupResult> {
        console.log(`[Lookup Asset] Buscando: ${processNumber}`);

        try {
            const lawsuitData = await legalOneApiService.getProcessDetails(processNumber);
            return this.extractData(lawsuitData, 'Lawsuit');
        } catch (lawsuitError: any) {
            try {
                const appealData = await legalOneApiService.getAppealDetails(processNumber);
                return this.extractData(appealData, 'Appeal');
            } catch (appealError: any) {
                try {
                    const issueData = await legalOneApiService.getProceduralIssueDetails(processNumber);
                    return this.extractData(issueData, 'ProceduralIssue');
                } catch (issueError: any) {
                    throw new Error(`Processo não encontrado.`);
                }
            }
        }
    }
}

export { LookupAssetFromLegalOneUseCase };