// src/modules/creditAssets/useCases/createCreditAsset/CreateCreditAssetUseCase.ts

import { PrismaClient, CreditAsset, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

// A MUDANÇA: Usando um tipo derivado diretamente do modelo CreditAsset do Prisma.
// Usamos o 'Pick' do TypeScript para selecionar apenas os campos necessários para a criação,
// garantindo que nosso DTO esteja sempre sincronizado com o schema.prisma.
type ICreateCreditAssetDTO = Pick<
    CreditAsset,
    | 'processNumber'
    | 'origemProcesso'
    | 'devedor'
    | 'originalValue'
    | 'acquisitionValue'
    | 'initialValue'
    | 'acquisitionDate'
    | 'status'
>;

/**
 * @class CreateCreditAssetUseCase
 * @description Contém a lógica de negócio para criar um novo ativo de crédito.
 */
class CreateCreditAssetUseCase {
    /**
     * Executa a criação do ativo de crédito.
     * @param {ICreateCreditAssetDTO} data - Os dados do ativo a serem criados.
     * @returns {Promise<CreditAsset>} O ativo recém-criado.
     */
    async execute({
        processNumber,
        origemProcesso,
        devedor,
        originalValue,
        acquisitionValue,
        initialValue,
        acquisitionDate,
        status,
    }: ICreateCreditAssetDTO): Promise<CreditAsset> {

        // 1. Validação: Verifica se já existe um ativo com o mesmo número de processo
        const assetAlreadyExists = await prisma.creditAsset.findUnique({
            where: { processNumber },
        });

        if (assetAlreadyExists) {
            throw new Error("Já existe um ativo de crédito com este número de processo.");
        }

        // 2. Criação: Usa o Prisma para criar o novo ativo no banco de dados.
        const newCreditAsset = await prisma.creditAsset.create({
            data: {
                processNumber,
                origemProcesso,
                devedor,
                originalValue,
                acquisitionValue,
                initialValue,
                currentValue: initialValue, // O valor atual começa igual ao valor inicial
                acquisitionDate,
                status,
            },
        });

        console.log(`✅ Novo ativo de crédito criado com sucesso: Processo ${processNumber}`);

        // 3. Retorno: Devolve o objeto do ativo recém-criado.
        return newCreditAsset;
    }
}

export { CreateCreditAssetUseCase };
