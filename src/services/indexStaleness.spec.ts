import { PrismaClient } from '@prisma/client';
import { EXPECTED_INDEX_LAG, findStaleIndexes, notifyStaleIndexes } from './indexUpdateService';
import { notifyAllAdmins } from './notificationService';

jest.mock('@prisma/client', () => {
    const mPrisma: any = {
        indexSeries: { findFirst: jest.fn() },
        jobRun:      { findUnique: jest.fn(), create: jest.fn() },
    };
    return { PrismaClient: jest.fn(() => mPrisma) };
});

jest.mock('./notificationService', () => ({ notifyAllAdmins: jest.fn() }));

const prisma = new PrismaClient() as any;

// 23/10/2026, 6h em Brasília
const OCT_23 = new Date('2026-10-23T09:00:00.000Z');

/** Último mês gravado de cada índice: todos em dia, menos os que o teste muda. */
let lastMonth: Record<string, { year: number; month: number } | null>;

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    lastMonth = Object.fromEntries(Object.keys(EXPECTED_INDEX_LAG).map(name => [name, { year: 2026, month: 9 }]));
    lastMonth.TJSP_LEI14905 = { year: 2026, month: 10 };
    prisma.indexSeries.findFirst.mockImplementation(({ where }: any) => Promise.resolve(lastMonth[where.indexName] ?? null));
    prisma.jobRun.findUnique.mockResolvedValue(null);
});

describe('findStaleIndexes', () => {
    it('com os índices no atraso normal, nada está parado', async () => {
        // O IPCA de 09/2026 só sai por volta de 10/11: em outubro, o último pode ser 08/2026
        lastMonth.IPCA = { year: 2026, month: 8 };

        await expect(findStaleIndexes(OCT_23)).resolves.toEqual([]);
    });

    it('acusa o índice mais atrasado que o normal e o que não tem nenhum mês', async () => {
        lastMonth.IPCA = { year: 2026, month: 3 };
        lastMonth.TJPR_MEDIA_INPC_IGPDI = { year: 2026, month: 8 };
        lastMonth.SELIC = null;

        const stale = await findStaleIndexes(OCT_23);

        expect(stale).toEqual(expect.arrayContaining([
            { indexName: 'IPCA', last: { year: 2026, month: 3 } },
            { indexName: 'TJPR_MEDIA_INPC_IGPDI', last: { year: 2026, month: 8 } },
            { indexName: 'SELIC', last: null },
        ]));
        expect(stale).toHaveLength(3);
    });
});

describe('notifyStaleIndexes', () => {
    it('avisa os admins uma vez por índice e mês', async () => {
        lastMonth.IPCA = { year: 2026, month: 3 };

        await notifyStaleIndexes(OCT_23);

        expect(prisma.jobRun.create).toHaveBeenCalledWith({ data: { job: 'INDEX_STALE', period: 'IPCA:2026-10', notifiedAt: expect.any(Date) } });
        expect(notifyAllAdmins).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Índice sem atualização',
            message: expect.stringContaining('O último mês de IPCA no banco de índices é 03/2026'),
        }));

        // No dia seguinte, o registro do mês já existe: não avisa de novo
        jest.clearAllMocks();
        prisma.jobRun.findUnique.mockResolvedValue({ id: 'run-1' });
        await notifyStaleIndexes(OCT_23);
        expect(notifyAllAdmins).not.toHaveBeenCalled();
    });

    it('sem nenhum mês gravado, o aviso diz que os cálculos com o índice são recusados', async () => {
        lastMonth.TAXA_LEGAL = null;

        await notifyStaleIndexes(OCT_23);

        expect(notifyAllAdmins).toHaveBeenCalledWith(expect.objectContaining({
            message: 'Não há nenhum mês de taxa legal no banco de índices, e os cálculos que precisam desse índice são recusados. Avise o suporte.',
        }));
    });
});
