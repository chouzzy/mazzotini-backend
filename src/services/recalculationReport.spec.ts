import { PrismaClient } from '@prisma/client';
import { notifyRecalculationFailures } from './recalculationReport';
import { notifyAllAdmins } from './notificationService';

jest.mock('@prisma/client', () => {
    const mPrisma: any = { creditAsset: { findMany: jest.fn() } };
    return { PrismaClient: jest.fn(() => mPrisma) };
});
jest.mock('./notificationService', () => ({ notifyAllAdmins: jest.fn() }));

const prisma = new PrismaClient() as any;
const notified = () => (notifyAllAdmins as jest.Mock).mock.calls[0][0];

describe('notifyRecalculationFailures', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Processos fictícios
        prisma.creditAsset.findMany.mockResolvedValue([
            { id: 'a1', legalOneId: 101, processNumber: 'PROC-FICTICIO-1' },
            { id: 'a2', legalOneId: 102, processNumber: 'PROC-FICTICIO-2' },
        ]);
    });

    it('lista cada processo recusado com o motivo, para os admins', async () => {
        await notifyRecalculationFailures([
            { assetId: 'a1', error: 'Não há IPCA para 06/1998: a série começa em 01/2000.' },
            { assetId: 'a2', error: 'Índice de correção desconhecido (Outro). Escolha um índice da lista.' },
        ]);

        expect(notified()).toMatchObject({
            title:            'Recálculo mensal: 2 processos ficaram com o valor anterior',
            type:             'warning',
            notificationType: 'CALCULATION',
        });
        expect(notified().message).toBe('O cálculo foi recusado e o valor atualizado não mudou. '
            + 'PROC-FICTICIO-1 (Legal One 101): Não há IPCA para 06/1998: a série começa em 01/2000. | '
            + 'PROC-FICTICIO-2 (Legal One 102): Índice de correção desconhecido (Outro). Escolha um índice da lista.');
    });

    it('com um só, o título fica no singular; um processo que sumiu aparece pelo id', async () => {
        await notifyRecalculationFailures([{ assetId: 'sem-cadastro', error: 'erro' }]);

        expect(notified().title).toBe('Recálculo mensal: 1 processo ficou com o valor anterior');
        expect(notified().message).toContain('sem-cadastro: erro');
    });

    it('lista até 10 e resume o resto', async () => {
        await notifyRecalculationFailures(Array.from({ length: 13 }, (_, i) => ({ assetId: `x${i}`, error: 'erro' })));

        expect(notified().message.split(' | ')).toHaveLength(11);
        expect(notified().message).toMatch(/ \| e mais 3\.$/);
    });

    it('sem falhas, não notifica', async () => {
        await notifyRecalculationFailures([]);

        expect(notifyAllAdmins).not.toHaveBeenCalled();
        expect(prisma.creditAsset.findMany).not.toHaveBeenCalled();
    });
});
