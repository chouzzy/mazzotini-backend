/**
 * Testes de integração: CreateCreditAssetUseCase
 *
 * O que é testado:
 * - Criação bem-sucedida de um Lawsuit
 * - Prevenção de duplicata por legalOneId
 * - Criação de investimento vinculado ao ativo
 * - Cadastro automático do Lawsuit pai ao criar Appeal
 * - Cadastro automático do Lawsuit pai ao criar ProceduralIssue
 * - Pai não duplicado se já existir no banco
 *
 * Usa o banco mazzotini_test. Legal One API é mockado.
 */

import { CreateCreditAssetUseCase } from '../../modules/creditAssets/useCases/createCreditAsset/CreateCreditAssetUseCase';
import { cleanTestDb, createTestUser, testPrisma } from '../helpers/dbHelpers';
import {
    MOCK_LAWSUIT_ID, MOCK_APPEAL_ID, MOCK_ISSUE_ID,
    mockLawsuit, mockAppeal, mockIssue,
    setupLegalOneMocks,
} from '../helpers/legalOneMocks';

// Mock do Legal One — nunca chama a API real nos testes
jest.mock('../../services/legalOneApiService', () => ({
    legalOneApiService: {
        getLawsuitById: jest.fn(),
        getAppealById: jest.fn(),
        getProceduralIssueById: jest.fn(),
        getEntityParticipants: jest.fn(),
        getAppealsByLawsuitId: jest.fn(),
        getProceduralIssuesByLawsuitId: jest.fn(),
        getProcessUpdates: jest.fn(),
        getProcessDocuments: jest.fn(),
        getAllByProcessNumber: jest.fn(),
        getEntitiesByFolderCode: jest.fn(),
    }
}));

// Mock do EnrichAssetFromLegalOneUseCase — o enriquecimento não é escopo deste teste
jest.mock('../../modules/creditAssets/useCases/enrichAssetFromLegalOne/EnrichAssetFromLegalOneUseCase', () => ({
    EnrichAssetFromLegalOneUseCase: jest.fn().mockImplementation(() => ({
        execute: jest.fn().mockResolvedValue(undefined)
    }))
}));

// Mock do participantHelper e folderHelper — dependências externas
jest.mock('../../utils/participantHelper', () => ({
    syncParticipantsAsUsers: jest.fn().mockResolvedValue([])
}));
jest.mock('../../utils/folderHelper', () => ({
    ensureProcessFolderExists: jest.fn().mockResolvedValue(null)
}));

import { legalOneApiService } from '../../services/legalOneApiService';
const mockedService = legalOneApiService as jest.Mocked<typeof legalOneApiService>;

describe('CreateCreditAssetUseCase', () => {
    let testUserId: string;
    const useCase = new CreateCreditAssetUseCase();

    beforeAll(async () => {
        await cleanTestDb();
        testUserId = await createTestUser('001');
    });

    beforeEach(() => {
        setupLegalOneMocks(mockedService);
    });

    afterAll(async () => {
        await cleanTestDb();
        await testPrisma.$disconnect();
    });

    // -----------------------------------------------------------------------
    // 1. Criação básica de um Lawsuit
    // -----------------------------------------------------------------------
    it('deve criar um ativo Lawsuit com status PENDING_ENRICHMENT', async () => {
        const result = await useCase.execute({
            processNumber: '0099999-88.2024.8.26.0100',
            legalOneId: MOCK_LAWSUIT_ID,
            legalOneType: 'Lawsuit',
            originalCreditor: 'Creditor Teste',
            otherParty: 'Devedor Teste',
            nickname: 'Devedor Teste',
            origemProcesso: 'TJSP - 1ª Vara Cível',
            originalValue: 100000,
            acquisitionValue: 50000,
            acquisitionDate: new Date('2024-01-15'),
            updateIndexType: 'IGPM',
            contractualIndexRate: null,
            folderId: null,
            investors: [{ userId: testUserId, share: 30 }],
        });

        expect(result.legalOneId).toBe(MOCK_LAWSUIT_ID);
        expect(result.status).toBe('PENDING_ENRICHMENT');
        expect(result.processNumber).toBe('0099999-88.2024.8.26.0100');

        // Verifica no banco
        const fromDb = await testPrisma.creditAsset.findUnique({ where: { legalOneId: MOCK_LAWSUIT_ID } });
        expect(fromDb).not.toBeNull();
    });

    // -----------------------------------------------------------------------
    // 2. Investimento foi criado corretamente
    // -----------------------------------------------------------------------
    it('deve criar o registro de investimento vinculado ao ativo', async () => {
        const asset = await testPrisma.creditAsset.findUnique({ where: { legalOneId: MOCK_LAWSUIT_ID } });
        expect(asset).not.toBeNull();

        const investment = await testPrisma.investment.findFirst({
            where: { creditAssetId: asset!.id, userId: testUserId }
        });

        expect(investment).not.toBeNull();
        expect(investment!.investorShare).toBe(30);
        expect(investment!.mazzotiniShare).toBe(70); // 100 - 30
    });

    // -----------------------------------------------------------------------
    // 3. Duplicata por legalOneId deve ser bloqueada
    // -----------------------------------------------------------------------
    it('deve lançar erro ao tentar cadastrar legalOneId duplicado', async () => {
        await expect(useCase.execute({
            processNumber: '0099999-88.2024.8.26.0100',
            legalOneId: MOCK_LAWSUIT_ID, // mesmo ID
            legalOneType: 'Lawsuit',
            originalCreditor: 'Creditor',
            otherParty: 'Devedor',
            nickname: 'Devedor',
            origemProcesso: 'TJSP',
            originalValue: 100000,
            acquisitionValue: 50000,
            acquisitionDate: new Date('2024-01-15'),
            updateIndexType: 'IGPM',
            contractualIndexRate: null,
            folderId: null,
            investors: [{ userId: testUserId, share: 10 }],
        })).rejects.toThrow('Já existe um ativo com este ID Legal One.');
    });

    // -----------------------------------------------------------------------
    // 4. Cadastrar Appeal → pai (Lawsuit) criado automaticamente
    // -----------------------------------------------------------------------
    it('deve criar o Lawsuit pai automaticamente ao cadastrar um Appeal', async () => {
        mockedService.getAppealById.mockResolvedValue(mockAppeal);
        mockedService.getLawsuitById.mockResolvedValue(mockLawsuit);

        // Remove o Lawsuit criado pelo teste 1 (com seus investimentos) para testar a criação automática
        const parentToDelete = await testPrisma.creditAsset.findUnique({ where: { legalOneId: MOCK_LAWSUIT_ID } });
        if (parentToDelete) {
            await testPrisma.investment.deleteMany({ where: { creditAssetId: parentToDelete.id } });
            await testPrisma.creditAsset.deleteMany({ where: { legalOneId: MOCK_LAWSUIT_ID } });
        }

        await useCase.execute({
            processNumber: mockAppeal.identifierNumber,
            legalOneId: MOCK_APPEAL_ID,
            legalOneType: 'Appeal',
            originalCreditor: 'Creditor Recurso',
            otherParty: 'Devedor Recurso',
            nickname: 'Devedor Recurso',
            origemProcesso: 'TJSP - 2ª Câmara',
            originalValue: 0,
            acquisitionValue: 0,
            acquisitionDate: new Date('2024-01-15'),
            updateIndexType: 'IGPM',
            contractualIndexRate: null,
            folderId: null,
            investors: [{ userId: testUserId, share: 20 }],
        });

        // Aguarda a Promise assíncrona do ensureParentLawsuit
        await new Promise(r => setTimeout(r, 500));

        const childInDb = await testPrisma.creditAsset.findUnique({ where: { legalOneId: MOCK_APPEAL_ID } });
        expect(childInDb).not.toBeNull();
        expect(childInDb!.legalOneType).toBe('Appeal');

        const parentInDb = await testPrisma.creditAsset.findUnique({ where: { legalOneId: MOCK_LAWSUIT_ID } });
        expect(parentInDb).not.toBeNull();
        expect(parentInDb!.legalOneType).toBe('Lawsuit');
    });

    // -----------------------------------------------------------------------
    // 5. Cadastrar ProceduralIssue → pai (Lawsuit) criado automaticamente
    // -----------------------------------------------------------------------
    it('deve criar o Lawsuit pai automaticamente ao cadastrar um ProceduralIssue', async () => {
        mockedService.getProceduralIssueById.mockResolvedValue(mockIssue);
        mockedService.getLawsuitById.mockResolvedValue(mockLawsuit);

        await useCase.execute({
            processNumber: mockIssue.identifierNumber,
            legalOneId: MOCK_ISSUE_ID,
            legalOneType: 'ProceduralIssue',
            originalCreditor: 'Creditor Incidente',
            otherParty: 'Devedor Incidente',
            nickname: 'Devedor Incidente',
            origemProcesso: 'TJSP - 3ª Vara',
            originalValue: 0,
            acquisitionValue: 0,
            acquisitionDate: new Date('2024-01-15'),
            updateIndexType: 'IGPM',
            contractualIndexRate: null,
            folderId: null,
            investors: [{ userId: testUserId, share: 15 }],
        });

        await new Promise(r => setTimeout(r, 500));

        const issueInDb = await testPrisma.creditAsset.findUnique({ where: { legalOneId: MOCK_ISSUE_ID } });
        expect(issueInDb).not.toBeNull();

        // Pai já existe do teste anterior — não deve ter criado duplicata
        const parents = await testPrisma.creditAsset.findMany({ where: { legalOneId: MOCK_LAWSUIT_ID } });
        expect(parents).toHaveLength(1); // Apenas um pai, sem duplicata
    });

    // -----------------------------------------------------------------------
    // 6. Múltiplos investidores: mazzotiniShare só no primeiro
    // -----------------------------------------------------------------------
    it('deve distribuir mazzotiniShare apenas para o primeiro investidor', async () => {
        const testUserId2 = await createTestUser('002');

        const result = await useCase.execute({
            processNumber: '0099999-77.2024.8.26.0100',
            legalOneId: 900099,
            legalOneType: 'Lawsuit',
            originalCreditor: 'Creditor Multi',
            otherParty: 'Devedor Multi',
            nickname: 'Devedor Multi',
            origemProcesso: 'TJSP',
            originalValue: 200000,
            acquisitionValue: 100000,
            acquisitionDate: new Date('2024-02-01'),
            updateIndexType: 'IGPM',
            contractualIndexRate: null,
            folderId: null,
            investors: [
                { userId: testUserId, share: 25 },
                { userId: testUserId2, share: 25 },
            ],
        });

        const investments = await testPrisma.investment.findMany({
            where: { creditAssetId: result.id },
            orderBy: { createdAt: 'asc' }
        });

        expect(investments).toHaveLength(2);
        expect(investments[0].mazzotiniShare).toBe(50); // 100 - 25 - 25
        expect(investments[1].mazzotiniShare).toBe(0);  // só no primeiro
    });
});
