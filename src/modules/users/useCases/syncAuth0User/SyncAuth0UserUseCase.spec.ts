import { SyncAuth0UserUseCase } from './SyncAuth0UserUseCase';
import { PrismaClient } from '@prisma/client';
import { auth0ManagementService } from '../../../../services/auth0ManagementService';

// 1. Mock do Prisma
jest.mock('@prisma/client', () => {
    const mPrisma = {
        user: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            update: jest.fn(),
            create: jest.fn(),
        },
    };
    return { PrismaClient: jest.fn(() => mPrisma) };
});

// 2. Mock do Auth0: a fonte confiável do e-mail (e da verificação) no primeiro login
jest.mock('../../../../services/auth0ManagementService', () => ({
    auth0ManagementService: { getUserIdentity: jest.fn() },
}));

const prisma = new PrismaClient();
const getUserIdentity = auth0ManagementService.getUserIdentity as jest.Mock;

describe('SyncAuth0UserUseCase', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    const useCase = new SyncAuth0UserUseCase();

    const mockLoginData = {
        auth0UserId: 'google-oauth2|123456',
        name: 'Cliente Real',
        picture: 'https://foto.com/perfil.jpg'
    };

    const verifiedIdentity = {
        email: 'cliente@gmail.com',
        emailVerified: true,
        name: 'Cliente Real',
        picture: 'https://foto.com/perfil.jpg',
    };

    // --- CENÁRIO 1: Usuário Já Vinculado (Login Padrão) ---
    it('deve retornar o usuário existente se já estiver vinculado pelo Auth0 ID', async () => {
        // Mock: Encontra direto pelo ID do Auth0
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({
            id: 'user-1',
            auth0UserId: mockLoginData.auth0UserId,
            name: 'Cliente Já Cadastrado'
        });

        const result = await useCase.execute(mockLoginData);

        expect(prisma.user.findUnique).toHaveBeenCalledWith({
            where: { auth0UserId: mockLoginData.auth0UserId }
        });
        // Não deve consultar o Auth0, buscar por email nem criar
        expect(getUserIdentity).not.toHaveBeenCalled();
        expect(prisma.user.findFirst).not.toHaveBeenCalled();
        expect(prisma.user.create).not.toHaveBeenCalled();

        expect(result.id).toBe('user-1');
    });

    // --- CENÁRIO 2: Usuário Sombra Encontrado (Merge) ---
    it('deve fazer o MERGE com o Shadow User quando o e-mail do Auth0 está verificado', async () => {
        // 1. Busca por Auth0 ID -> Null (Nunca logou antes)
        (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);
        getUserIdentity.mockResolvedValueOnce(verifiedIdentity);

        // 2. Busca por Email -> Encontra o Shadow User (criado pela importação)
        const shadowUser = {
            id: 'user-shadow-1',
            email: verifiedIdentity.email,
            auth0UserId: 'legalone|import|999', // ID Temporário
            name: 'Nome do LegalOne'
        };
        (prisma.user.findFirst as jest.Mock).mockResolvedValueOnce(shadowUser);

        // 3. Mock do Update
        (prisma.user.update as jest.Mock).mockResolvedValue({
            ...shadowUser,
            auth0UserId: mockLoginData.auth0UserId // ID Atualizado
        });

        await useCase.execute(mockLoginData);

        // Verificações
        expect(getUserIdentity).toHaveBeenCalledWith(mockLoginData.auth0UserId);
        expect(prisma.user.findFirst).toHaveBeenCalledWith({
            where: { email: verifiedIdentity.email }
        });

        expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: shadowUser.id },
            data: expect.objectContaining({
                auth0UserId: mockLoginData.auth0UserId, // O ID deve ser substituído
                profilePictureUrl: verifiedIdentity.picture
            })
        });

        expect(prisma.user.create).not.toHaveBeenCalled();
    });

    // --- CENÁRIO 3: E-mail não verificado (bloqueia a tomada de conta) ---
    it('deve recusar o MERGE com 403 quando o e-mail ainda não foi verificado', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);
        getUserIdentity.mockResolvedValueOnce({ ...verifiedIdentity, emailVerified: false });
        (prisma.user.findFirst as jest.Mock).mockResolvedValueOnce({
            id: 'user-admin-1',
            email: verifiedIdentity.email,
            auth0UserId: 'auth0|dono-original',
        });

        await expect(useCase.execute(mockLoginData)).rejects.toMatchObject({
            statusCode: 403,
            code: 'EMAIL_NOT_VERIFIED',
        });

        expect(prisma.user.update).not.toHaveBeenCalled();
        expect(prisma.user.create).not.toHaveBeenCalled();
    });

    // --- CENÁRIO 4: O e-mail do corpo da requisição não decide nada ---
    it('deve usar o e-mail do Auth0, e não um e-mail enviado pelo cliente', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);
        getUserIdentity.mockResolvedValueOnce({ ...verifiedIdentity, email: 'atacante@exemplo.com' });
        (prisma.user.findFirst as jest.Mock).mockResolvedValueOnce(null);
        (prisma.user.create as jest.Mock).mockResolvedValue({ id: 'new-user-2' });

        // Simula um corpo forjado: o campo extra não faz parte do contrato do use case
        await useCase.execute({ ...mockLoginData, email: 'vitima@exemplo.com' } as any);

        expect(prisma.user.findFirst).toHaveBeenCalledWith({
            where: { email: 'atacante@exemplo.com' }
        });
        expect(prisma.user.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ email: 'atacante@exemplo.com' })
        });
    });

    // --- CENÁRIO 5: Usuário Novo (Cadastro Zero) ---
    it('deve criar um novo usuário se não existir nem por ID nem por E-mail', async () => {
        // 1. Busca por ID -> Null
        (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);
        getUserIdentity.mockResolvedValueOnce(verifiedIdentity);

        // 2. Busca por Email -> Null
        (prisma.user.findFirst as jest.Mock).mockResolvedValueOnce(null);

        // 3. Mock do Create
        (prisma.user.create as jest.Mock).mockResolvedValue({
            id: 'new-user-1',
            email: verifiedIdentity.email,
            status: 'PENDING_ONBOARDING'
        });

        await useCase.execute(mockLoginData);

        expect(prisma.user.create).toHaveBeenCalledWith({
            data: {
                auth0UserId: mockLoginData.auth0UserId,
                email: verifiedIdentity.email,
                name: verifiedIdentity.name,
                profilePictureUrl: verifiedIdentity.picture,
                status: 'PENDING_ONBOARDING', // Deve forçar o cadastro
                role: 'INVESTOR'
            }
        });
    });

    // --- CENÁRIO 6: Conta sem e-mail no Auth0 ---
    it('deve recusar com 400 quando a conta não tem e-mail no Auth0', async () => {
        (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);
        getUserIdentity.mockResolvedValueOnce({ ...verifiedIdentity, email: null });

        await expect(useCase.execute(mockLoginData)).rejects.toMatchObject({ statusCode: 400 });

        expect(prisma.user.findFirst).not.toHaveBeenCalled();
        expect(prisma.user.create).not.toHaveBeenCalled();
    });
});
