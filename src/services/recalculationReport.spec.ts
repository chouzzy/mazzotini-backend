import { describeAsset, failureReason, notifyRecalculationFailures } from './recalculationReport';
import { notifyAllAdmins } from './notificationService';

jest.mock('./notificationService', () => ({ notifyAllAdmins: jest.fn() }));

const notified = () => (notifyAllAdmins as jest.Mock).mock.calls.map(call => call[0]);

// Processos fictícios
const failure = (i: number) => ({ assetId: `a${i}`, legalOneId: 100 + i, processNumber: `PROC-FICTICIO-${i}`, error: 'Índice de correção desconhecido (Outro). Escolha um índice da lista.' });

describe('notifyRecalculationFailures', () => {
    beforeEach(() => jest.clearAllMocks());

    it('cria uma notificação por processo, com o processo na coluna da entidade e o motivo na mensagem', async () => {
        await notifyRecalculationFailures([failure(1), { ...failure(2), error: 'Falta IPCA de 02/2023 no banco de índices. Avise o suporte.' }]);

        expect(notified()).toEqual([
            {
                title:             'Recálculo mensal recusado',
                message:           'Processo PROC-FICTICIO-1 (Legal One 101): Índice de correção desconhecido (Outro). Escolha um índice da lista. O valor atualizado continua o anterior.',
                type:              'warning',
                notificationType:  'CALCULATION',
                relatedEntityId:   'a1',
                relatedEntityType: 'CreditAsset',
                relatedEntityName: 'PROC-FICTICIO-1 (Legal One 101)',
                link:              '/processos/101',
            },
            expect.objectContaining({
                message:           'Processo PROC-FICTICIO-2 (Legal One 102): Falta IPCA de 02/2023 no banco de índices. Avise o suporte. O valor atualizado continua o anterior.',
                relatedEntityName: 'PROC-FICTICIO-2 (Legal One 102)',
            }),
        ]);
    });

    it('notifica até 20 processos e resume o resto numa notificação', async () => {
        await notifyRecalculationFailures(Array.from({ length: 23 }, (_, i) => failure(i + 1)));

        expect(notified()).toHaveLength(21);
        expect(notified()[20]).toEqual({
            title:            'Recálculo mensal recusado',
            message:          'Mais 3 processos foram recusados e ficaram com o valor anterior. Avise o suporte para ver a lista completa.',
            type:             'warning',
            notificationType: 'CALCULATION',
            link:             '/processos',
        });
    });

    it('sem falhas, não notifica', async () => {
        await notifyRecalculationFailures([]);

        expect(notifyAllAdmins).not.toHaveBeenCalled();
    });
});

describe('describeAsset', () => {
    it('mostra o número do processo e o do Legal One, ou o id quando o processo não existe mais', () => {
        expect(describeAsset({ assetId: 'a1', legalOneId: 101, processNumber: 'PROC-FICTICIO-1' })).toBe('PROC-FICTICIO-1 (Legal One 101)');
        expect(describeAsset({ assetId: 'a1', legalOneId: 101, processNumber: null })).toBe('(Legal One 101)');
        expect(describeAsset({ assetId: 'a1' })).toBe('a1');
    });
});

describe('failureReason', () => {
    it('erro do banco: só o código, sem o texto técnico (que fica no log)', () => {
        const e = Object.assign(new Error('Raw query failed. Message: Server selection timeout. Topology: { Address: servidor.exemplo:27017 }'), {
            name: 'PrismaClientKnownRequestError', code: 'P2010',
        });

        expect(failureReason(e)).toBe('Erro do banco de dados (P2010) ao recalcular; o detalhe ficou no log do servidor.');
    });

    it('erro do banco sem código', () => {
        expect(failureReason(Object.assign(new Error('Invalid invocation'), { name: 'PrismaClientUnknownRequestError' })))
            .toBe('Erro do banco de dados ao recalcular; o detalhe ficou no log do servidor.');
    });

    it('recusa do cálculo vai como é', () => {
        expect(failureReason(new Error('Falta IPCA de 02/2023 no banco de índices. Avise o suporte.')))
            .toBe('Falta IPCA de 02/2023 no banco de índices. Avise o suporte.');
    });
});
