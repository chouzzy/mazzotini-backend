/**
 * Testes de integração: SyncSingleAssetUseCase
 *
 * O que é testado:
 * - Sync sem andamentos novos: nenhum AssetUpdate criado
 * - Sync com andamento taggeado: AssetUpdate criado, currentValue atualizado
 * - Andamento sem tag #RelatórioMAA: ignorado
 * - Andamento já existente: não duplicado
 * - Documento taggeado: Document criado no banco
 * - Malha Fina: filhos novos cadastrados quando Legal One retorna Appeals
 *
 * Usa o banco mazzotini_test. Legal One API é mockado.
 */

import { SyncSingleAssetUseCase } from '../../modules/creditAssets/useCases/syncSingleAsset/SyncSingleAssetUseCase';
import { cleanTestDb, createTestUser, testPrisma } from '../helpers/dbHelpers';
import {
    MOCK_LAWSUIT_ID, MOCK_APPEAL_ID,
    mockAppeal, mockUpdate, mockDocument,
    setupLegalOneMocks,
} from '../helpers/legalOneMocks';

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
        getProcessDetails: jest.fn(),
        getAllByProcessNumber: jest.fn(),
    }
}));

jest.mock('../../modules/creditAssets/useCases/enrichAssetFromLegalOne/EnrichAssetFromLegalOneUseCase', () => ({
    EnrichAssetFromLegalOneUseCase: jest.fn().mockImplementation(() => ({
        execute: jest.fn().mockResolvedValue(undefined)
    }))
}));

import { legalOneApiService } from '../../services/legalOneApiService';
const mockedService = legalOneApiService as jest.Mocked<typeof legalOneApiService>;

describe('SyncSingleAssetUseCase', () => {
    let testUserId: string;
    let testAssetId: string;
    const useCase = new SyncSingleAssetUseCase();

    beforeAll(async () => {
        await cleanTestDb();
        testUserId = await createTestUser('sync-001');

        // Cria o ativo de teste diretamente no banco
        const asset = await testPrisma.creditAsset.create({
            data: {
                processNumber: '0099999-88.2024.8.26.0100',
                legalOneId: MOCK_LAWSUIT_ID,
                legalOneType: 'Lawsuit',
                originalCreditor: 'Creditor Sync',
                otherParty: 'Devedor Sync',
                nickname: 'Devedor Sync',
                origemProcesso: 'TJSP',
                originalValue: 100000,
                acquisitionValue: 50000,
                currentValue: 60000,
                acquisitionDate: new Date('2024-01-15'),
                updateIndexType: 'IGPM',
                contractualIndexRate: null,
                status: 'Ativo',
            }
        });
        testAssetId = asset.id;

        await testPrisma.investment.create({
            data: {
                creditAssetId: asset.id,
                userId: testUserId,
                investorShare: 30,
                mazzotiniShare: 70,
            }
        });
    });

    beforeEach(() => {
        setupLegalOneMocks(mockedService);
        jest.clearAllMocks();
        setupLegalOneMocks(mockedService);
    });

    afterAll(async () => {
        await cleanTestDb();
        await testPrisma.$disconnect();
    });

    // -----------------------------------------------------------------------
    // 1. Sem andamentos novos → nenhum AssetUpdate criado
    // -----------------------------------------------------------------------
    it('não deve criar AssetUpdate quando não há andamentos novos', async () => {
        mockedService.getProcessUpdates.mockResolvedValue([]);
        mockedService.getProcessDocuments.mockResolvedValue([]);

        await useCase.execute(MOCK_LAWSUIT_ID);

        const updates = await testPrisma.assetUpdate.findMany({ where: { assetId: testAssetId } });
        expect(updates).toHaveLength(0);
    });

    // -----------------------------------------------------------------------
    // 2. Andamento com tag → AssetUpdate criado e currentValue atualizado
    // -----------------------------------------------------------------------
    it('deve criar AssetUpdate e atualizar currentValue ao encontrar andamento taggeado', async () => {
        mockedService.getProcessUpdates.mockResolvedValue([mockUpdate]);
        mockedService.getProcessDocuments.mockResolvedValue([]);

        await useCase.execute(MOCK_LAWSUIT_ID);

        const updates = await testPrisma.assetUpdate.findMany({ where: { assetId: testAssetId } });
        expect(updates).toHaveLength(1);
        expect(updates[0].legalOneUpdateId).toBe(mockUpdate.id);

        const asset = await testPrisma.creditAsset.findUnique({ where: { id: testAssetId } });
        expect(asset!.currentValue).toBe(75000); // Valor Atualizado do mockUpdate
        expect(asset!.originalValue).toBe(100000); // Valor da Causa
        expect(asset!.acquisitionValue).toBe(50000); // Valor da Compra
    });

    // -----------------------------------------------------------------------
    // 3. Andamento sem tag → ignorado
    // -----------------------------------------------------------------------
    it('deve ignorar andamentos sem a tag #RelatórioMAA', async () => {
        const updateSemTag = {
            id: 80002,
            date: '2024-07-01T10:00:00.000Z',
            description: 'Andamento sem tag especial. Processo em tramitação.',
            originType: 'Sistema',
        };
        mockedService.getProcessUpdates.mockResolvedValue([updateSemTag]);
        mockedService.getProcessDocuments.mockResolvedValue([]);

        await useCase.execute(MOCK_LAWSUIT_ID);

        const updates = await testPrisma.assetUpdate.findMany({
            where: { assetId: testAssetId, legalOneUpdateId: updateSemTag.id }
        });
        expect(updates).toHaveLength(0);
    });

    // -----------------------------------------------------------------------
    // 4. Andamento já existente → não duplicado
    // -----------------------------------------------------------------------
    it('não deve duplicar AssetUpdate já existente', async () => {
        // mockUpdate já foi salvo no teste 2
        mockedService.getProcessUpdates.mockResolvedValue([mockUpdate]);
        mockedService.getProcessDocuments.mockResolvedValue([]);

        await useCase.execute(MOCK_LAWSUIT_ID);

        const updates = await testPrisma.assetUpdate.findMany({
            where: { assetId: testAssetId, legalOneUpdateId: mockUpdate.id }
        });
        expect(updates).toHaveLength(1); // Ainda apenas 1, não duplicou
    });

    // -----------------------------------------------------------------------
    // 5. Documento taggeado → Document criado no banco
    // -----------------------------------------------------------------------
    it('deve criar Document ao encontrar documento com tag #DocumentoMAA', async () => {
        mockedService.getProcessUpdates.mockResolvedValue([]);
        mockedService.getProcessDocuments.mockResolvedValue([mockDocument]);

        await useCase.execute(MOCK_LAWSUIT_ID);

        const docs = await testPrisma.document.findMany({ where: { assetId: testAssetId } });
        expect(docs.length).toBeGreaterThanOrEqual(1);

        const doc = docs.find(d => d.legalOneDocumentId === mockDocument.id);
        expect(doc).not.toBeUndefined();
        expect(doc!.name).toBe('Petição Inicial'); // sem a tag no nome
    });

    // -----------------------------------------------------------------------
    // 6. Malha Fina: filho (Appeal) não cadastrado → deve criar
    // -----------------------------------------------------------------------
    it('deve cadastrar filho (Appeal) via Malha Fina se não existir no banco', async () => {
        mockedService.getProcessUpdates.mockResolvedValue([]);
        mockedService.getProcessDocuments.mockResolvedValue([]);
        mockedService.getAppealsByLawsuitId.mockResolvedValue([mockAppeal]);
        mockedService.getEntityParticipants.mockResolvedValue([]);

        await useCase.execute(MOCK_LAWSUIT_ID);

        // Aguarda o processamento assíncrono
        await new Promise(r => setTimeout(r, 500));

        const child = await testPrisma.creditAsset.findUnique({ where: { legalOneId: MOCK_APPEAL_ID } });
        expect(child).not.toBeNull();
        expect(child!.legalOneType).toBe('Appeal');
    });
});
