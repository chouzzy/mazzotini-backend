// src/modules/creditAssets/useCases/createCreditAsset/CreateCreditAssetUseCase.ts

import { PrismaClient, CreditAsset } from "@prisma/client";
// 1. Importa o UseCase de enriquecimento
import { EnrichAssetFromLegalOneUseCase } from "../enrichAssetFromLegalOne/EnrichAssetFromLegalOneUseCase";

const prisma = new PrismaClient();

// A MUDANÇA: Interface preenchida com os dados que o operador insere manualmente.
// Usamos o 'Pick' do TypeScript para garantir que os tipos estejam sempre sincronizados com o schema.prisma.
type ICreateCreditAssetDTO = Pick<CreditAsset,
    | 'processNumber' 
    | 'acquisitionValue'
    | 'initialValue'
    | 'acquisitionDate'
    | 'originalValue'
    | 'originalCreditor'
>;

/**
 * @class CreateCreditAssetUseCase
 * @description Lógica de negócio para criar o "esqueleto" de um ativo e disparar o enriquecimento.
 */
class CreateCreditAssetUseCase {
    async execute(data: ICreateCreditAssetDTO): Promise<CreditAsset> {
        
        const assetAlreadyExists = await prisma.creditAsset.findUnique({
            where: { processNumber: data.processNumber },
        });

        if (assetAlreadyExists) {
            throw new Error("Já existe um ativo de crédito com este número de processo.");
        }

        // 2. Cria o ativo com um status "pendente"
        const newCreditAsset = await prisma.creditAsset.create({
            data: {
                ...data, // Espalha os dados recebidos (processNumber, acquisitionValue, etc.)
                status: 'PENDING_ENRICHMENT', // Status inicial
                
                // Campos que serão preenchidos pelo Legal One são inicializados com valores padrão.
                origemProcesso: 'Aguardando Legal One...',
                originalCreditor: 'Aguardando Legal One...',
                originalValue: 0, // Será preenchido pelo Legal One
                currentValue: data.initialValue, // O valor atual começa igual ao valor inicial
            },
        });

        console.log(`✅ Esqueleto do ativo criado: Processo ${newCreditAsset.processNumber}`);

        // 3. A MÁGICA: Aciona o processo de enriquecimento em segundo plano.
        // Não usamos 'await' aqui para que a resposta ao frontend seja imediata.
        const enrichUseCase = new EnrichAssetFromLegalOneUseCase();
        enrichUseCase.execute(newCreditAsset.id);
        
        return newCreditAsset;
    }
}

export { CreateCreditAssetUseCase };
