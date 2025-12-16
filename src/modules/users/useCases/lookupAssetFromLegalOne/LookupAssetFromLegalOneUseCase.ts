import { PrismaClient } from "@prisma/client";
// ATUALIZADO: Importando os 3 tipos (Assumindo que estão exportados do service)
import {
    legalOneApiService,
} from "../../../../services/legalOneApiService";

const prisma = new PrismaClient();

// ATUALIZADO: A interface de retorno agora inclui os dados para o banco
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
        // Usamos 'any' porque os tipos são muito similares, mas não idênticos
        processData: any,
        entityType: 'Lawsuit' | 'Appeal' | 'ProceduralIssue'
    ): ILookupResult {

        console.log('Process Data:', processData);

        // 1. Encontrar o Credor Original (Cliente Principal)
        const customer = processData.participants.find((p: any) => p.type === "Customer");
        const originalCreditor = customer ? customer.contactName : "Credor não encontrado";

        // 2. Montar a Origem do Processo (Vara/Turma)
        let origemProcesso = processData.title || "Origem não encontrada"; // Fallback

        if (processData.courtPanel && processData.courtPanelNumberText) {
            // Ex: "30 Vara Cível"
            origemProcesso = `${processData.courtPanelNumberText} ${processData.courtPanel.description}`;
        }
        else if (processData.courtPanel) {
            origemProcesso = processData.courtPanel.description;
        }

        console.log(`[Lookup Asset] Dados encontrados: Credor: ${originalCreditor}, Origem: ${origemProcesso}`);

        return {
            originalCreditor,
            origemProcesso,
            legalOneId: processData.id,
            legalOneType: entityType // Retorna a "flag" interna
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
            console.log(this.extractData(lawsuitData, 'Lawsuit'));
            return this.extractData(lawsuitData, 'Lawsuit');

        } catch (lawsuitError: any) {
            console.warn(`[Lookup Asset] Não encontrado como 'Lawsuit'. Tentando 'Appeals'...`);

            // --- TENTATIVA 2: Buscar na gaveta de RECURSOS (Appeals) ---
            try {
                const appealData = await legalOneApiService.getAppealDetails(processNumber);
                console.log("[Lookup Asset] Encontrado como 'Appeal'.");
                console.log(this.extractData(appealData, 'Appeal'))
                return this.extractData(appealData, 'Appeal');

            } catch (appealError: any) {
                console.warn(`[Lookup Asset] Não encontrado como 'Appeal'. Tentando 'ProceduralIssues'...`);

                // --- TENTATIVA 3: Buscar na gaveta de INCIDENTES (ProceduralIssues) ---
                try {
                    const issueData = await legalOneApiService.getProceduralIssueDetails(processNumber);
                    console.log("[Lookup Asset] Encontrado como 'ProceduralIssue'.");
                    console.log(this.extractData(issueData, 'ProceduralIssue'));
                    return this.extractData(issueData, 'ProceduralIssue');

                } catch (issueError: any) {
                    // Se falhar nas três, lança o erro final
                    console.error(`[Lookup Asset] Falha ao buscar como 'ProceduralIssue': ${issueError.message}`);
                    // O erro de getProceduralIssueDetails já é "Nenhum... encontrado"
                    throw issueError;
                }
            }
        }
    }
}

export { LookupAssetFromLegalOneUseCase };