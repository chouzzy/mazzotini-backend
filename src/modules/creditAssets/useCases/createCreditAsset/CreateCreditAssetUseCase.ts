// ============================================================================
//   ARQUIVO: src/modules/creditAssets/useCases/createCreditAsset/CreateCreditAssetUseCase.ts
// ============================================================================

import { PrismaClient, CreditAsset, User, Investment } from "@prisma/client";
import { EnrichAssetFromLegalOneUseCase } from "../enrichAssetFromLegalOne/EnrichAssetFromLegalOneUseCase";

const prisma = new PrismaClient();

// A MUDANÇA: O tipo agora reflete o schema.prisma sem o 'initialValue'.
type ICreateCreditAssetDTO =
    Pick<CreditAsset,
        'processNumber' |
        'originalCreditor' |
        'originalValue' |
        'acquisitionValue' |
        'acquisitionDate'
    > & {
        investorId: User['id'];
        investorShare: Investment['investorShare'];
        associateId?: User['id']; // NOVO CAMPO (opcional)
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
            ...assetData // O resto dos dados para o CreditAsset
        } = data;

        // 1. Validação: Verifica se o ativo já existe
        const assetAlreadyExists = await prisma.creditAsset.findUnique({
            where: { processNumber },
        });

        if (assetAlreadyExists) {
            throw new Error("Já existe um ativo de crédito com este número de processo.");
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

        // 3. Criação Atómica com Transação
        const newCreditAsset = await prisma.$transaction(async (tx) => {
            // 3.1. Cria o "esqueleto" do ativo com status pendente
            const createdAsset = await tx.creditAsset.create({
                data: {
                    ...assetData,
                    processNumber,
                    status: 'PENDING_ENRICHMENT',
                    // A MUDANÇA: O valor atual agora é inicializado com o valor de aquisição.
                    currentValue: assetData.acquisitionValue,
                    // Campos que serão preenchidos pelo Legal One
                    origemProcesso: 'Aguardando Legal One...',
                    associateId: associateId
                    // O 'originalCreditor' já está em 'assetData'
                },
            });

            // 3.2. Cria o registo de investimento, ligando o utilizador ao ativo
            await tx.investment.create({
                data: {
                    investorShare: investorShare,
                    mazzotiniShare: 100 - investorShare,
                    userId: investorId,
                    creditAssetId: createdAsset.id,
                }
            });

            console.log(`✅ Esqueleto do ativo e investimento criados para o processo ${createdAsset.processNumber}`);

            return createdAsset;
        });

        // 4. Dispara o processo de enriquecimento em segundo plano
        const enrichUseCase = new EnrichAssetFromLegalOneUseCase();
        enrichUseCase.execute(newCreditAsset.id);

        return newCreditAsset;
    }
}

export { CreateCreditAssetUseCase };