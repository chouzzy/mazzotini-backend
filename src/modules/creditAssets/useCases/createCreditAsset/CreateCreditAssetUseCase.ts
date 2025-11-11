import { PrismaClient, CreditAsset, User, Investment } from "@prisma/client";
import { EnrichAssetFromLegalOneUseCase } from "../enrichAssetFromLegalOne/EnrichAssetFromLegalOneUseCase"; // Importa o UseCase de enriquecimento

const prisma = new PrismaClient();

// ATUALIZADO: O DTO (Data Transfer Object) agora reflete TODOS os campos
// que o frontend inteligente está enviando.
type ICreateCreditAssetDTO =
    Pick<CreditAsset,
        'processNumber' |
        'originalCreditor' |
        'origemProcesso' |       // <-- NOVO
        'legalOneId' |           // <-- NOVO
        'legalOneType' |         // <-- NOVO
        'originalValue' |
        'acquisitionValue' |
        'acquisitionDate' |
        'updateIndexType' |      // <-- NOVO
        'contractualIndexRate'   // <-- NOVO
    > & {
        investorId: User['id'];
        investorShare: Investment['investorShare'];
        associateId?: User['id'];
    };

/**
 * @class CreateCreditAssetUseCase
 * @description Lógica de negócio para criar um ativo e o seu investimento associado.
 */
class CreateCreditAssetUseCase {
    async execute(data: ICreateCreditAssetDTO): Promise<CreditAsset> {

        const {
            processNumber,
            investorId,
            investorShare,
            associateId,
            // O resto dos dados (incluindo os novos) vão para 'assetData'
            ...assetData 
        } = data;

        // 1. Validação: Verifica se o ativo já existe
        const assetAlreadyExists = await prisma.creditAsset.findFirst({
            where: { 
                // Um processo não pode ser cadastrado duas vezes
                OR: [
                    { processNumber: processNumber },
                    { legalOneId: assetData.legalOneId } // Nem o ID do Legal One
                ]
            },
        });

        if (assetAlreadyExists) {
            throw new Error(`Já existe um ativo de crédito com este Número de Processo (${processNumber}) ou ID Legal One (${assetData.legalOneId}).`);
        }

        // 2. Validação: Verifica se o investidor (User) existe
        const investorExists = await prisma.user.findUnique({
            where: { id: investorId }
        });

        if (!investorExists) {
            throw new Error("O investidor selecionado não foi encontrado no sistema.");
        }

        // 3. Validação: Se um associateId foi fornecido, verifica se ele existe
        if (associateId) {
            const associateExists = await prisma.user.findUnique({
                where: { id: associateId }
            });

            if (!associateExists) {
                throw new Error("O associado selecionado não foi encontrado no sistema.");
            }
        }

        // 4. Criação Atómica com Transação
        const newCreditAsset = await prisma.$transaction(async (tx) => {
            
            // 4.1. Cria o ativo com os dados completos
            const createdAsset = await tx.creditAsset.create({
                data: {
                    ...assetData, // Contém todos os campos novos (origemProcesso, legalOneId, etc.)
                    processNumber: processNumber,
                    status: 'PENDING_ENRICHMENT', // Inicia pendente de buscar ANDAMENTOS
                    
                    // O valor atual é inicializado com o valor de aquisição.
                    // O 'originalValue' (valor de face) é salvo, mas não usado como 'currentValue'
                    currentValue: assetData.originalValue, 
                    
                    // Conecta ao Associado (Vendedor), se houver
                    associateId: associateId 
                },
            });

            // 4.2. Cria o registo de investimento, ligando o utilizador ao ativo
            await tx.investment.create({
                data: {
                    investorShare: investorShare,
                    mazzotiniShare: 100 - investorShare,
                    userId: investorId,
                    creditAssetId: createdAsset.id,
                }
            });

            console.log(`✅ Ativo e investimento criados para o processo ${createdAsset.processNumber} (LegalOne ID: ${createdAsset.legalOneId})`);

            return createdAsset;
        });

        // 5. Dispara o processo de enriquecimento (agora focado SÓ em ANDAMENTOS)
        // Usamos o 'execute' fora da transação (não precisamos esperar)
        const enrichUseCase = new EnrichAssetFromLegalOneUseCase();
        enrichUseCase.execute(newCreditAsset.id)
            .catch(err => {
                // Loga o erro, mas não quebra a requisição principal
                console.error(`[Enrich-Trigger] Falha ao iniciar enriquecimento para ${newCreditAsset.id}:`, err.message);
            });

        return newCreditAsset;
    }
}

export { CreateCreditAssetUseCase };