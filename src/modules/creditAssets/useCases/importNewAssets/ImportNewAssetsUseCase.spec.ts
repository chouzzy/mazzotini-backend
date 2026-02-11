import { PrismaClient } from '@prisma/client';

// 1. Definição do Mock do Prisma (O nome PRECISA começar com 'mock' para o hoisting funcionar)
const mockPrisma = {
    creditAsset: {
        findUnique: jest.fn(),
    },
    $disconnect: jest.fn(),
};

// 2. Mocks das Dependências
// Mock do Prisma usando a variável global que o Jest permite acessar
jest.mock('@prisma/client', () => {
    return {
        PrismaClient: jest.fn(() => mockPrisma),
    };
});

jest.mock('../../../../services/legalOneApiService');
jest.mock('../../../users/useCases/lookupAssetFromLegalOne/LookupAssetFromLegalOneUseCase');
jest.mock('../createCreditAsset/CreateCreditAssetUseCase');

// 3. Imports TARDIAIS (Depois dos Mocks)
// Embora o import seja estático, o mock acima garante que o 'new PrismaClient()'
// dentro do arquivo importado receba o nosso 'mockPrisma'.
import { ImportNewAssetsUseCase } from './ImportNewAssetsUseCase';
import { legalOneApiService } from '../../../../services/legalOneApiService';
import { CreateCreditAssetUseCase } from '../createCreditAsset/CreateCreditAssetUseCase';
import { LookupAssetFromLegalOneUseCase } from '../../../users/useCases/lookupAssetFromLegalOne/LookupAssetFromLegalOneUseCase';

describe('ImportNewAssetsUseCase', () => {
    let importUseCase: ImportNewAssetsUseCase;
    let mockLookupInstance: any;
    let mockCreateInstance: any;

    beforeEach(() => {
        jest.clearAllMocks();

        // Configura os mocks dos UseCases internos
        mockLookupInstance = { execute: jest.fn() };
        (LookupAssetFromLegalOneUseCase as jest.Mock).mockImplementation(() => mockLookupInstance);

        mockCreateInstance = { execute: jest.fn() };
        (CreateCreditAssetUseCase as jest.Mock).mockImplementation(() => mockCreateInstance);

        // Instancia a classe
        importUseCase = new ImportNewAssetsUseCase();
    });

    it('deve importar processos novos com sucesso', async () => {
        // ARRANGE
        (legalOneApiService.listLawsuits as jest.Mock).mockResolvedValue([
            { identifierNumber: 'PROCESSO-001' },
            { identifierNumber: 'PROCESSO-002' }
        ]);

        // Configura o mock do Prisma para retornar null (não existe)
        // Como 'mockPrisma' é global, ele afeta a instância dentro do UseCase
        (mockPrisma.creditAsset.findUnique as jest.Mock).mockResolvedValue(null);

        mockLookupInstance.execute.mockResolvedValue({
            legalOneId: 100,
            legalOneType: 'Lawsuit',
            originalCreditor: 'Credor Teste',
            origemProcesso: 'Vara Teste',
            otherParty: 'Devedor Teste',
            suggestedInvestors: []
        });

        // ACT
        await importUseCase.execute();

        // ASSERT
        expect(legalOneApiService.listLawsuits).toHaveBeenCalled();
        
        // Verifica Prisma
        expect(mockPrisma.creditAsset.findUnique).toHaveBeenCalledTimes(2);
        expect(mockPrisma.creditAsset.findUnique).toHaveBeenCalledWith({ where: { processNumber: 'PROCESSO-001' } });

        // Verifica Lógica
        expect(mockLookupInstance.execute).toHaveBeenCalledTimes(2);
        expect(mockCreateInstance.execute).toHaveBeenCalledTimes(2);
        expect(mockCreateInstance.execute).toHaveBeenCalledWith(expect.objectContaining({
            processNumber: 'PROCESSO-001',
            originalCreditor: 'Credor Teste'
        }));
    });

    it('deve pular processos que já existem no banco (Idempotência)', async () => {
        // ARRANGE
        (legalOneApiService.listLawsuits as jest.Mock).mockResolvedValue([
            { identifierNumber: 'PROCESSO-EXISTENTE' }
        ]);

        // Prisma diz que JÁ EXISTE
        (mockPrisma.creditAsset.findUnique as jest.Mock).mockResolvedValue({ id: 'asset-1' });

        // ACT
        await importUseCase.execute();

        // ASSERT
        expect(mockLookupInstance.execute).not.toHaveBeenCalled();
        expect(mockCreateInstance.execute).not.toHaveBeenCalled();
    });

    it('deve continuar a importação mesmo se um processo falhar', async () => {
        // ARRANGE
        (legalOneApiService.listLawsuits as jest.Mock).mockResolvedValue([
            { identifierNumber: 'PROCESSO-FALHA' },
            { identifierNumber: 'PROCESSO-SUCESSO' }
        ]);

        (mockPrisma.creditAsset.findUnique as jest.Mock).mockResolvedValue(null);

        // O primeiro falha
        mockLookupInstance.execute.mockRejectedValueOnce(new Error("Erro de conexão no Legal One"));
        // O segundo funciona
        mockLookupInstance.execute.mockResolvedValueOnce({
            legalOneId: 200,
            legalOneType: 'Lawsuit',
            suggestedInvestors: []
        });

        // ACT
        await importUseCase.execute();

        // ASSERT
        expect(mockCreateInstance.execute).toHaveBeenCalledTimes(1);
        expect(mockCreateInstance.execute).toHaveBeenCalledWith(expect.objectContaining({
            processNumber: 'PROCESSO-SUCESSO'
        }));
    });
});