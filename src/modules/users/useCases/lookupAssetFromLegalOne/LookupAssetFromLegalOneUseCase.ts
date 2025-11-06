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

        if (!lawsuit) {
            throw new Error("Processo não encontrado no Legal One.");
        }


        console.log(' Lawsuit Data:', JSON.stringify(lawsuit, null, 2)); // Log detalhado para depuração
        // 2. Define a Origem do Processo (Vara/Turma)
        // No nosso schema, 'origemProcesso' é o 'title' do Legal One.
        const origemProcesso = lawsuit.title;

        // 3. Encontra o Credor Original (Cliente Principal)
        const customerParticipant = lawsuit.participants.find(p => p.type === "Customer");

        if (!customerParticipant) {
            console.warn(`[Lookup Asset] Processo ${processNumber} encontrado, mas não possui "Customer".`);
            // Retorna o que temos, mesmo sem o credor
            return {
                originalCreditor: "Cliente não encontrado no Legal One",
                origemProcesso: origemProcesso,
            };
        }

        // 4. Busca os detalhes do contato do Cliente Principal
        const contactDetails = await legalOneApiService.getContactDetails(customerParticipant.contactId);

        if (!contactDetails) {
            throw new Error("Cliente (Customer) encontrado, mas detalhes do contato não puderam ser carregados.");
        }

        console.log(`[Lookup Asset] Dados encontrados: Credor: ${contactDetails.name}, Origem: ${origemProcesso}`);

        // 5. Retorna os dados formatados
        return {
            originalCreditor: contactDetails.name,
            origemProcesso: origemProcesso,
        };
    }
}

export { LookupAssetFromLegalOneUseCase };