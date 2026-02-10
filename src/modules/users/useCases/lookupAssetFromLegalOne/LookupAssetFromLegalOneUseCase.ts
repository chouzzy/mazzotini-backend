import { 
    legalOneApiService 
} from "../../../../services/legalOneApiService";
import { syncParticipantsAsUsers } from "../../../../utils/participantHelper"; // <--- NOVO IMPORT

// A interface de retorno com os dados para o banco
interface ILookupResult {
    originalCreditor: string;
    origemProcesso: string;
    legalOneId: number;
    legalOneType: 'Lawsuit' | 'Appeal' | 'ProceduralIssue';
    otherParty?: string;
    nickname?: string;
}

class LookupAssetFromLegalOneUseCase {

    /**
     * Função auxiliar para extrair dados comuns
     */
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
        
        // 1. Encontrar o Credor Original (Customer)
        const customer = participants.find((p: any) => p.type === "Customer");
        const originalCreditor = customer ? customer.contactName : "Credor não identificado";
        
        // 2. Encontrar a Parte Contrária (OtherParty)
        const otherPartyObj = participants.find((p: any) => p.type === "OtherParty" && p.isMainParticipant) 
                        || participants.find((p: any) => p.type === "OtherParty");
                        
        const otherParty = otherPartyObj ? otherPartyObj.contactName : undefined;
        // Usa o OtherParty como sugestão de Nickname também
        const nickname = otherParty;

        // 3. Montar a Origem do Processo
        let origemProcesso = processData.title || "Origem não identificada"; 

        if (processData.courtPanel && processData.courtPanelNumberText) {
            origemProcesso = `${processData.courtPanelNumberText} ${processData.courtPanel.description}`;
        }
        else if (processData.courtPanel) {
            origemProcesso = processData.courtPanel.description;
        }

        console.log(`[Lookup] Credor: ${originalCreditor}, Parte Contrária: ${otherParty}`);

        return {
            originalCreditor,
            origemProcesso,
            legalOneId: processData.id,
            legalOneType: entityType,
            otherParty,
            nickname
        };
    }

    /**
     * Executa a busca e SINCRONIZA PARTICIPANTES
     */
    async execute(processNumber: string): Promise<ILookupResult> {
        console.log(`[Lookup Asset] Buscando e Sincronizando: ${processNumber}`);

        // --- TENTATIVA 1: Lawsuits ---
        try {
            const lawsuitData = await legalOneApiService.getProcessDetails(processNumber);
            console.log("[Lookup Asset] Encontrado como 'Lawsuit'.");
            
            // MÁGICA AQUI: Sincroniza os clientes encontrados com o nosso banco de usuários
            if (lawsuitData.participants) {
                await syncParticipantsAsUsers(lawsuitData.participants);
            }

            return this.extractData(lawsuitData, 'Lawsuit');

        } catch (lawsuitError: any) {
            console.warn(`[Lookup Asset] Não encontrado como 'Lawsuit'. Tentando 'Appeals'...`);

            // --- TENTATIVA 2: Appeals ---
            try {
                const appealData = await legalOneApiService.getAppealDetails(processNumber);
                console.log("[Lookup Asset] Encontrado como 'Appeal'.");

                // MÁGICA AQUI
                if (appealData.participants) {
                    await syncParticipantsAsUsers(appealData.participants);
                }

                return this.extractData(appealData, 'Appeal');

            } catch (appealError: any) {
                console.warn(`[Lookup Asset] Não encontrado como 'Appeal'. Tentando 'ProceduralIssues'...`);

                // --- TENTATIVA 3: ProceduralIssues ---
                try {
                    const issueData = await legalOneApiService.getProceduralIssueDetails(processNumber);
                    console.log("[Lookup Asset] Encontrado como 'ProceduralIssue'.");

                    // MÁGICA AQUI
                    if (issueData.participants) {
                        await syncParticipantsAsUsers(issueData.participants);
                    }

                    return this.extractData(issueData, 'ProceduralIssue');

                } catch (issueError: any) {
                    console.error(`[Lookup Asset] Esgotadas todas as tentativas.`);
                    throw new Error(`Processo ${processNumber} não encontrado em nenhuma categoria.`);
                }
            }
        }
    }
}

export { LookupAssetFromLegalOneUseCase };