/**
 * Testes de integração — Fluxo de Aprovação e Rejeição de Usuários
 *
 * Usa banco de testes real (MongoDB Atlas) mas mocka todos os serviços externos:
 *  - legalOneApiService  (API do Legal One)
 *  - auth0ManagementService (Auth0 Management API)
 *  - axios (download de documentos do S3)
 */

// ─── Mocks de serviços externos (devem vir antes dos imports) ────────────────
jest.mock('../../services/legalOneApiService', () => ({
    legalOneApiService: {
        getContactByCPF: jest.fn(),
        getContactByRG: jest.fn(),
        createContact: jest.fn(),
        updateContact: jest.fn(),
        getUploadContainer: jest.fn(),
        uploadFileToContainer: jest.fn(),
        finalizeDocument: jest.fn(),
    },
}));

jest.mock('../../services/auth0ManagementService', () => ({
    auth0ManagementService: {
        deleteUser: jest.fn(),
    },
}));

jest.mock('axios');

// ─── Imports ─────────────────────────────────────────────────────────────────
import { PrismaClient } from '@prisma/client';
import { AppError } from '../../errors/AppError';
import { ApproveUserProfileUseCase } from '../../modules/management/useCases/approveUserProfile/ApproveUserProfileUseCase';
import { RejectUserProfileUseCase } from '../../modules/management/useCases/rejectUserProfile/RejectUserProfileUseCase';
import { legalOneApiService } from '../../services/legalOneApiService';
import { auth0ManagementService } from '../../services/auth0ManagementService';
import { cleanTestDb, testPrisma } from '../helpers/dbHelpers';

const prisma = new PrismaClient();

// ─── Setup e Teardown ─────────────────────────────────────────────────────────
beforeAll(async () => {
    await cleanTestDb();
});

afterAll(async () => {
    await cleanTestDb();
    await prisma.$disconnect();
});

beforeEach(() => {
    jest.clearAllMocks();
});

// ─── Helpers locais ───────────────────────────────────────────────────────────
async function createPendingUser(suffix: string, overrides: Record<string, unknown> = {}) {
    return prisma.user.create({
        data: {
            auth0UserId: `test|pending-${suffix}`,
            email: `pending-${suffix}@mazzotini.test`,
            name: `Usuário Pendente ${suffix}`,
            role: 'INVESTOR',
            status: 'PENDING_REVIEW',
            cpfOrCnpj: '12345678900',
            ...overrides,
        },
    });
}

const MOCK_LEGAL_ONE_CONTACT = { id: 9001, name: 'Usuário Pendente' };

// ─── ApproveUserProfileUseCase ────────────────────────────────────────────────
describe('ApproveUserProfileUseCase', () => {
    const useCase = new ApproveUserProfileUseCase();

    it('deve aprovar usuário PENDING_REVIEW, criar contato no Legal One e ativar no banco', async () => {
        const user = await createPendingUser('approve-happy');

        // Legal One não encontra pelo CPF → cria novo contato
        (legalOneApiService.getContactByCPF as jest.Mock).mockResolvedValue(null);
        (legalOneApiService.createContact as jest.Mock).mockResolvedValue(MOCK_LEGAL_ONE_CONTACT);

        await useCase.execute(user.id);

        // Verifica que o serviço foi chamado corretamente
        expect(legalOneApiService.getContactByCPF).toHaveBeenCalledWith(user.cpfOrCnpj);
        expect(legalOneApiService.createContact).toHaveBeenCalled();
        expect(legalOneApiService.updateContact).not.toHaveBeenCalled();

        // Verifica que o banco foi atualizado
        const updated = await prisma.user.findUnique({ where: { id: user.id } });
        expect(updated?.status).toBe('ACTIVE');
        expect(updated?.legalOneContactId).toBe(MOCK_LEGAL_ONE_CONTACT.id);
    });

    it('deve atualizar contato existente no Legal One se CPF já estiver cadastrado', async () => {
        const user = await createPendingUser('approve-existing-contact');

        // Legal One JÁ tem o contato → atualiza ao invés de criar
        (legalOneApiService.getContactByCPF as jest.Mock).mockResolvedValue(MOCK_LEGAL_ONE_CONTACT);
        (legalOneApiService.updateContact as jest.Mock).mockResolvedValue(undefined);

        await useCase.execute(user.id);

        expect(legalOneApiService.updateContact).toHaveBeenCalledWith(
            MOCK_LEGAL_ONE_CONTACT.id,
            expect.objectContaining({ id: user.id }),
            undefined // sem associado
        );
        expect(legalOneApiService.createContact).not.toHaveBeenCalled();

        const updated = await prisma.user.findUnique({ where: { id: user.id } });
        expect(updated?.status).toBe('ACTIVE');
    });

    it('deve lançar AppError 409 se o usuário não estiver PENDING_REVIEW', async () => {
        const user = await createPendingUser('approve-wrong-status', { status: 'ACTIVE' });

        await expect(useCase.execute(user.id)).rejects.toThrow(AppError);
        await expect(useCase.execute(user.id)).rejects.toMatchObject({ statusCode: 409 });

        // Não deve chamar o Legal One
        expect(legalOneApiService.getContactByCPF).not.toHaveBeenCalled();
    });

    it('deve lançar AppError 422 se o usuário não tiver documento (CPF/RG)', async () => {
        const user = await createPendingUser('approve-no-doc', {
            cpfOrCnpj: null,
            rg: null,
        });

        await expect(useCase.execute(user.id)).rejects.toThrow(AppError);
        await expect(useCase.execute(user.id)).rejects.toMatchObject({ statusCode: 422 });
    });

    it('deve vincular o nome do associado ao criar contato no Legal One', async () => {
        // Cria o associado primeiro
        const associate = await prisma.user.create({
            data: {
                auth0UserId: 'test|associate-mgmt-001',
                email: 'associate-mgmt@mazzotini.test',
                name: 'Associado Gestor',
                role: 'ASSOCIATE',
                status: 'ACTIVE',
            },
        });

        const user = await createPendingUser('approve-with-associate', {
            referredById: associate.id,
        });

        (legalOneApiService.getContactByCPF as jest.Mock).mockResolvedValue(null);
        (legalOneApiService.createContact as jest.Mock).mockResolvedValue(MOCK_LEGAL_ONE_CONTACT);

        await useCase.execute(user.id);

        // Verifica que o nome do associado foi passado para o Legal One
        expect(legalOneApiService.createContact).toHaveBeenCalledWith(
            expect.anything(),
            'Associado Gestor'
        );
    });
});

// ─── RejectUserProfileUseCase ─────────────────────────────────────────────────
describe('RejectUserProfileUseCase', () => {
    const useCase = new RejectUserProfileUseCase();

    it('deve excluir o usuário do Auth0 e do banco ao rejeitar', async () => {
        const user = await createPendingUser('reject-happy');

        (auth0ManagementService.deleteUser as jest.Mock).mockResolvedValue(undefined);

        await useCase.execute(user.id);

        // Auth0 deve ter sido chamado com o ID correto
        expect(auth0ManagementService.deleteUser).toHaveBeenCalledWith(user.auth0UserId);

        // Usuário não deve mais existir no banco
        const deleted = await testPrisma.user.findUnique({ where: { id: user.id } });
        expect(deleted).toBeNull();
    });

    it('deve lançar erro se o Auth0 falhar (banco não é alterado)', async () => {
        const user = await createPendingUser('reject-auth0-fail');

        (auth0ManagementService.deleteUser as jest.Mock).mockRejectedValue(
            new Error('Auth0 API indisponível')
        );

        await expect(useCase.execute(user.id)).rejects.toThrow('Auth0 API indisponível');

        // Usuário AINDA deve existir no banco (Auth0 falhou primeiro)
        const stillExists = await testPrisma.user.findUnique({ where: { id: user.id } });
        expect(stillExists).not.toBeNull();
    });
});
