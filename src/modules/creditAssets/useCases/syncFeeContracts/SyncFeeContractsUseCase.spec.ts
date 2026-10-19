import { SyncFeeContractsUseCase } from './SyncFeeContractsUseCase';
import { PrismaClient } from '@prisma/client';
import { legalOneApiService } from '../../../../services/legalOneApiService';

jest.mock('@prisma/client', () => {
    const mPrisma = {
        document: { findFirst: jest.fn(), create: jest.fn() },
        user: { findFirst: jest.fn() },
        processFolder: { findFirst: jest.fn() },
    };
    return { PrismaClient: jest.fn(() => mPrisma) };
});

jest.mock('../../../../services/legalOneApiService', () => ({
    legalOneApiService: {
        getPrivateDocuments: jest.fn(),
        getContactIdentification: jest.fn(),
        getDocumentDownloadUrl: jest.fn(),
    },
}));

const prisma = new PrismaClient();
const getPrivateDocuments = legalOneApiService.getPrivateDocuments as jest.Mock;
const getContactIdentification = legalOneApiService.getContactIdentification as jest.Mock;

/** Documento do Legal One ligado a um contrato e a um contato (dados fictícios). */
const legalOneDoc = (id: number, type: string, contactId = 10) => ({
    id,
    type,
    archive: `documento-${id}.pdf`,
    relationships: [
        { link: 'Contract', linkItem: { id: 500, description: 'Proc - 0000001/001' } },
        { link: 'Contact', linkItem: { id: contactId } },
    ],
});

describe('SyncFeeContractsUseCase', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        (prisma.document.findFirst as jest.Mock).mockResolvedValue(null);
        (prisma.document.create as jest.Mock).mockResolvedValue({});
        (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'cliente-1' });
        (prisma.processFolder.findFirst as jest.Mock).mockResolvedValue(null);
        getContactIdentification.mockResolvedValue('00000000000');
        (legalOneApiService.getDocumentDownloadUrl as jest.Mock).mockResolvedValue('https://exemplo.com/documento');
    });

    it('importa o #Nfs-e como nota fiscal privada do cliente', async () => {
        getPrivateDocuments.mockResolvedValue([legalOneDoc(1, '#Nfs-e')]);

        const result = await new SyncFeeContractsUseCase().execute();

        expect(result.documentsImported).toBe(1);
        expect(prisma.document.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                category: 'NOTA_FISCAL',
                section: 'PRIVADO_FINANCEIRO',
                investorUserId: 'cliente-1',
                legalOneDocumentId: 1,
            }),
        });
    });

    it('duas chamadas ao mesmo tempo compartilham a mesma execução', async () => {
        let release: (docs: unknown[]) => void = () => {};
        getPrivateDocuments.mockReturnValue(new Promise(resolve => { release = resolve; }));

        // Ex.: o cron diário e o botão em Configurações ao mesmo tempo
        const first = new SyncFeeContractsUseCase().execute();
        const second = new SyncFeeContractsUseCase().execute();
        release([legalOneDoc(1, '#Nfs-e')]);
        const [a, b] = await Promise.all([first, second]);

        expect(getPrivateDocuments).toHaveBeenCalledTimes(1);
        expect(prisma.document.create).toHaveBeenCalledTimes(1);
        expect(a).toBe(b);
    });
});
