import { 
    legalOneApiService 
} from "../../../../services/legalOneApiService";

// A interface de retorno com os dados para o banco
interface ILookupResult {
    originalCreditor: string;
    origemProcesso: string;
    legalOneId: number;
    legalOneType: 'Lawsuit' | 'Appeal' | 'ProceduralIssue';
}

class LookupAssetFromLegalOneUseCase {

    /**
     * Função auxiliar para extrair dados comuns de qualquer uma das 3 entidades
     */
    private extractData(
        processData: any,
        entityType: 'Lawsuit' | 'Appeal' | 'ProceduralIssue'
    ): ILookupResult {

        console.log('[extractData] Iniciando extração de dados...');
        console.log('[extractData] Entity Type:', entityType);
        
        // 1. Encontrar o Credor Original (Cliente Principal)
        // CORREÇÃO: Garante que participants seja um array, mesmo se vier null/undefined da API
        const participants = processData.participants || [];
        
        console.log(`[extractData] Buscando participante do tipo "Customer" em ${participants.length} participantes...`);
        
        const customer = participants.find((p: any) => p.type === "Customer");
        
        if (customer) {
            console.log('[extractData] "Customer" encontrado:', customer.contactName);
        } else {
            console.log('[extractData] Nenhum participante do tipo "Customer" foi encontrado.');
        }

        const originalCreditor = customer ? customer.contactName : "Credor não identificado";

        // 2. Montar a Origem do Processo (Vara/Turma)
        let origemProcesso = processData.title || "Origem não identificada"; // Fallback inicial

        if (processData.courtPanel && processData.courtPanelNumberText) {
            // Ex: "32 Vara Cível"
            origemProcesso = `${processData.courtPanelNumberText} ${processData.courtPanel.description}`;
        }
        else if (processData.courtPanel) {
            // Ex: "Vara Cível" (sem número)
            origemProcesso = processData.courtPanel.description;
        }

        console.log(`[Lookup Asset] Dados extraídos: Credor: ${originalCreditor}, Origem: ${origemProcesso}`);

        return {
            originalCreditor,
            origemProcesso,
            legalOneId: processData.id,
            legalOneType: entityType
        };
    }

    /**
     * Executa a busca "em três gavetas": Lawsuits -> Appeals -> ProceduralIssues
     */
    async execute(processNumber: string): Promise<ILookupResult> {
        console.log(`[Lookup Asset] Buscando (Três Gavetas) o processo: ${processNumber}`);

        // --- TENTATIVA 1: Buscar na gaveta de PROCESSOS (Lawsuits) ---
        try {
            const lawsuitData = await legalOneApiService.getProcessDetails(processNumber);
            console.log("[Lookup Asset] Encontrado como 'Lawsuit'.");
            return this.extractData(lawsuitData, 'Lawsuit');

        } catch (lawsuitError: any) {
            // Se o erro não for "Nenhum encontrado", pode ser um erro real de API, mas
            // assumimos que é "não encontrado" e tentamos o próximo.
            console.warn(`[Lookup Asset] Não encontrado como 'Lawsuit' (${lawsuitError.message}). Tentando 'Appeals'...`);

            // --- TENTATIVA 2: Buscar na gaveta de RECURSOS (Appeals) ---
            try {
                const appealData = await legalOneApiService.getAppealDetails(processNumber);
                console.log("[Lookup Asset] Encontrado como 'Appeal'.");
                return this.extractData(appealData, 'Appeal');

            } catch (appealError: any) {
                console.warn(`[Lookup Asset] Não encontrado como 'Appeal'. Tentando 'ProceduralIssues'...`);

                // --- TENTATIVA 3: Buscar na gaveta de INCIDENTES (ProceduralIssues) ---
                try {
                    const issueData = await legalOneApiService.getProceduralIssueDetails(processNumber);
                    console.log("[Lookup Asset] Encontrado como 'ProceduralIssue'.");
                    return this.extractData(issueData, 'ProceduralIssue');

                } catch (issueError: any) {
                    // Se falhar nas três, lança o erro final
                    console.error(`[Lookup Asset] Esgotadas todas as tentativas. Último erro: ${issueError.message}`);
                    throw new Error(`Processo ${processNumber} não encontrado em nenhuma categoria (Processo, Recurso ou Incidente).`);
                }
            }
        }
    }
}

export { LookupAssetFromLegalOneUseCase };