/**
 * Dados e configurações de mock para o legalOneApiService.
 * Use makeLegalOneMocks() nos testes que precisam do Legal One mockado.
 */

export const MOCK_LAWSUIT_ID = 900001;
export const MOCK_APPEAL_ID = 900002;
export const MOCK_ISSUE_ID = 900003;
export const MOCK_PROCESS_NUMBER = '0099999-88.2024.8.26.0100';

export const mockLawsuit = {
    id: MOCK_LAWSUIT_ID,
    folder: 'Proc-Test-0001',
    title: 'Processo de Teste',
    identifierNumber: MOCK_PROCESS_NUMBER,
    participants: [],
    courtPanel: { id: 1, description: 'TJSP' },
    courtPanelNumberText: '1ª Vara Cível',
};

export const mockAppeal = {
    id: MOCK_APPEAL_ID,
    folder: 'Proc-Test-0001/001',
    title: 'Recurso de Teste',
    identifierNumber: '0099999-88.2024.8.26.0200',
    participants: [],
    relatedLitigationId: MOCK_LAWSUIT_ID,
    relatedLitigationType: 'Lawsuit',
    courtPanel: { id: 1, description: 'TJSP' },
    courtPanelNumberText: '2ª Câmara',
};

export const mockIssue = {
    id: MOCK_ISSUE_ID,
    folder: 'Proc-Test-0001/002',
    title: 'Incidente de Teste',
    identifierNumber: '0099999-88.2024.8.26.0300',
    participants: [],
    relatedLitigationId: MOCK_LAWSUIT_ID,
    relatedLitigationType: 'Lawsuit',
    courtPanel: { id: 1, description: 'TJSP' },
    courtPanelNumberText: '3ª Vara Cível',
};

export const mockUpdate = {
    id: 80001,
    date: '2024-06-01T10:00:00.000Z',
    description: '#RelatórioMAA\nValor da Causa: R$ 100.000,00\nValor da Compra: R$ 50.000,00\nValor Atualizado: R$ 75.000,00\nProcesso em andamento normal.',
    originType: 'Manual',
};

export const mockDocument = {
    id: 70001,
    archive: '#DocumentoMAA - Petição Inicial',
    description: 'Petição Inicial',
    type: 'Petição',
};

/**
 * Configura todos os mocks do legalOneApiService para um cenário padrão.
 * Chame dentro de beforeEach ou no início do teste.
 */
export function setupLegalOneMocks(mockedService: any) {
    mockedService.getLawsuitById.mockResolvedValue(mockLawsuit);
    mockedService.getAppealById.mockResolvedValue(mockAppeal);
    mockedService.getProceduralIssueById.mockResolvedValue(mockIssue);
    mockedService.getEntityParticipants.mockResolvedValue([]);
    mockedService.getAppealsByLawsuitId.mockResolvedValue([]);
    mockedService.getProceduralIssuesByLawsuitId.mockResolvedValue([]);
    mockedService.getProcessUpdates.mockResolvedValue([]);
    mockedService.getProcessDocuments.mockResolvedValue([]);
    mockedService.getAllByProcessNumber.mockResolvedValue([]);
    mockedService.getEntitiesByFolderCode.mockResolvedValue([]);
    mockedService.syncParticipantsAsUsers?.mockResolvedValue([]);
}
