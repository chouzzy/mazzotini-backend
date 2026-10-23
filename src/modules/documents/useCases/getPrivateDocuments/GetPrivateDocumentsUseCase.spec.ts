import { PrismaClient } from '@prisma/client';
import { GetPrivateDocumentsUseCase } from './GetPrivateDocumentsUseCase';
import { GetDownloadUrlUseCase } from '../getDownloadUrl/GetDownloadUrlUseCase';
import { legalOneApiService } from '../../../../services/legalOneApiService';

jest.mock('@prisma/client', () => {
    const mPrisma: any = {
        user: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn() },
        document: { findMany: jest.fn(), findUnique: jest.fn() },
        investment: { findFirst: jest.fn() },
    };
    return { PrismaClient: jest.fn(() => mPrisma) };
});

jest.mock('../../../../services/legalOneApiService', () => ({
    legalOneApiService: { getDocumentDownloadUrl: jest.fn() },
}));

const prisma = new PrismaClient() as any;

/** Cadastro fictício do cliente, com o status de cada caso. */
const client = (status: string | null) => ({ id: 'cliente-1', role: 'INVESTOR', status });

beforeEach(() => {
    jest.clearAllMocks();
    prisma.document.findMany.mockResolvedValue([{ id: 'doc-1' }]);
    prisma.document.findUnique.mockResolvedValue({ id: 'doc-1', legalOneDocumentId: 123, investorUserId: 'cliente-1', assetId: null });
    (legalOneApiService.getDocumentDownloadUrl as jest.Mock).mockResolvedValue('https://exemplo.com/doc');
});

describe('GetPrivateDocumentsUseCase', () => {
    it.each([['ACTIVE'], [null]])('lista os documentos do cadastro aprovado ou antigo (status %s)', async (status) => {
        prisma.user.findUniqueOrThrow.mockResolvedValue(client(status));

        await expect(new GetPrivateDocumentsUseCase().execute('auth0|cliente')).resolves.toEqual([{ id: 'doc-1' }]);
    });

    it.each([['PENDING_ONBOARDING'], ['PENDING_REVIEW']])('não lista nada com o cadastro em %s', async (status) => {
        prisma.user.findUniqueOrThrow.mockResolvedValue(client(status));

        await expect(new GetPrivateDocumentsUseCase().execute('auth0|cliente')).resolves.toEqual([]);
        expect(prisma.document.findMany).not.toHaveBeenCalled();
    });
});

describe('GetDownloadUrlUseCase', () => {
    it('gera o link do documento do próprio cliente aprovado', async () => {
        prisma.user.findUnique.mockResolvedValue(client('ACTIVE'));

        await expect(new GetDownloadUrlUseCase().execute('doc-1', 'auth0|cliente')).resolves.toBe('https://exemplo.com/doc');
    });

    it('recusa o cadastro ainda em análise, mesmo sendo o dono do documento', async () => {
        prisma.user.findUnique.mockResolvedValue(client('PENDING_REVIEW'));

        await expect(new GetDownloadUrlUseCase().execute('doc-1', 'auth0|cliente')).rejects.toThrow('Sem permissão');
        expect(legalOneApiService.getDocumentDownloadUrl).not.toHaveBeenCalled();
    });

    it('admin baixa qualquer documento', async () => {
        prisma.user.findUnique.mockResolvedValue({ id: 'admin-1', role: 'ADMIN', status: 'ACTIVE' });

        await expect(new GetDownloadUrlUseCase().execute('doc-1', 'auth0|admin')).resolves.toBe('https://exemplo.com/doc');
    });
});
