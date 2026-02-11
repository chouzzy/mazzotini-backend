import { SyncAuth0UserUseCase } from './SyncAuth0UserUseCase';
import { PrismaClient } from '@prisma/client';

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

const prisma = new PrismaClient();

describe('SyncAuth0UserUseCase', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const useCase = new SyncAuth0UserUseCase();

    const mockLoginData = {
        auth0UserId: 'google-oauth2|123456',
        email: 'cliente@gmail.com',
        name: 'Cliente Real',
        picture: 'https://foto.com/perfil.jpg'
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
        // Não deve tentar buscar por email nem criar
        expect(prisma.user.findFirst).not.toHaveBeenCalled(); 
        expect(prisma.user.create).not.toHaveBeenCalled();
        
        expect(result.id).toBe('user-1');
    });

    // --- CENÁRIO 2: Usuário Sombra Encontrado (Merge) ---
    it('deve fazer o MERGE se não achar pelo ID mas achar pelo E-mail (Shadow User)', async () => {
        // 1. Busca por Auth0 ID -> Null (Nunca logou antes)
        (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);

        // 2. Busca por Email -> Encontra o Shadow User (criado pela importação)
        const shadowUser = { 
            id: 'user-shadow-1', 
            email: mockLoginData.email, 
            auth0UserId: 'legalone|import|999', // ID Temporário
            name: 'Nome do LegalOne' 
        };
        (prisma.user.findFirst as jest.Mock).mockResolvedValueOnce(shadowUser);

        // 3. Mock do Update
        (prisma.user.update as jest.Mock).mockResolvedValue({
            ...shadowUser,
            auth0UserId: mockLoginData.auth0UserId // ID Atualizado
        });

        const result = await useCase.execute(mockLoginData);

        // Verificações
        expect(prisma.user.findFirst).toHaveBeenCalledWith({
            where: { email: mockLoginData.email }
        });

        expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: shadowUser.id },
            data: expect.objectContaining({
                auth0UserId: mockLoginData.auth0UserId, // O ID deve ser substituído
                profilePictureUrl: mockLoginData.picture
            })
        });

        expect(prisma.user.create).not.toHaveBeenCalled();
    });

    // --- CENÁRIO 3: Usuário Novo (Cadastro Zero) ---
    it('deve criar um novo usuário se não existir nem por ID nem por E-mail', async () => {
        // 1. Busca por ID -> Null
        (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);
        
        // 2. Busca por Email -> Null
        (prisma.user.findFirst as jest.Mock).mockResolvedValueOnce(null);

        // 3. Mock do Create
        (prisma.user.create as jest.Mock).mockResolvedValue({
            id: 'new-user-1',
            email: mockLoginData.email,
            status: 'PENDING_ONBOARDING'
        });

        await useCase.execute(mockLoginData);

        expect(prisma.user.create).toHaveBeenCalledWith({
            data: {
                auth0UserId: mockLoginData.auth0UserId,
                email: mockLoginData.email,
                name: mockLoginData.name,
                profilePictureUrl: mockLoginData.picture,
                status: 'PENDING_ONBOARDING', // Deve forçar o cadastro
                role: 'INVESTOR'
            }
        });
    });
});