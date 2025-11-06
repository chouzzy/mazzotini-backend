import { legalOneApiService } from "../../../../services/legalOneApiService";

// Interface para a resposta do UseCase
interface ILookupResponse {
    originalCreditor: string;
    origemProcesso: string;
}

class LookupAssetFromLegalOneUseCase {
    async execute(processNumber: string): Promise<ILookupResponse> {
        console.log(`[Lookup Asset] Buscando dados do processo: ${processNumber}`);

        // 1. Busca os dados brutos do processo no Legal One
        const lawsuit = await legalOneApiService.getProcessDetails(processNumber);

        // Adiciona um log dos dados brutos para debug futuro
        console.log(`[Lookup Asset] Lawsuit Data:`, JSON.stringify(lawsuit, null, 2));

        if (!lawsuit) {
            throw new Error("Processo não encontrado no Legal One.");
        }

        // 2. Define a Origem do Processo (Vara/Turma) - **LÓGICA CORRIGIDA**
        // Concatenamos o número (courtPanelNumberText) e a descrição (courtPanel.description)
        const origemParts = [];
        if (lawsuit.courtPanelNumberText) {
            origemParts.push(lawsuit.courtPanelNumberText);
        }
        if (lawsuit.courtPanel?.description) {
            origemParts.push(lawsuit.courtPanel.description);
        }
        
        // Se a concatenação falhar, usamos o 'title' como último recurso
        const origemProcesso = origemParts.join(' ') || lawsuit.title || "Origem não informada";


        // 3. Encontra o Credor Original (Cliente Principal) - **LÓGICA OTIMIZADA**
        // Otimização: Pegar o nome direto do objeto 'participants', sem nova chamada de API.
        
        // Tenta achar o "Customer" principal primeiro
        let customerParticipant = lawsuit.participants.find(p => p.type === "Customer" && p.isMainParticipant);
        
        // Se não achar um "principal", pega o primeiro "Customer" que encontrar
        if (!customerParticipant) {
             customerParticipant = lawsuit.participants.find(p => p.type === "Customer");
        }

        let originalCreditor = "Cliente não encontrado no Legal One";
        
        if (customerParticipant) {
            // Usamos o 'contactName' que já veio no objeto!
            originalCreditor = customerParticipant.contactName ?? 'Nome do credor não disponível';
        } else {
            console.warn(`[Lookup Asset] Processo ${processNumber} encontrado, mas não possui "Customer".`);
        }

        // 4. (REMOVIDO) A chamada antiga ao getContactDetails(customerParticipant.contactId) não é mais necessária.

        console.log(`[Lookup Asset] Dados encontrados: Credor: ${originalCreditor}, Origem: ${origemProcesso}`);

        // 5. Retorna os dados formatados
        return {
            originalCreditor: originalCreditor,
            origemProcesso: origemProcesso,
        };
    }
}

export { LookupAssetFromLegalOneUseCase };