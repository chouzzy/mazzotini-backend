import { syncParticipantsAsUsers } from './participantHelper';
import { legalOneApiService } from '../services/legalOneApiService';
import { PrismaClient } from '@prisma/client';

// 1. Mock das dependências externas
// Isso impede que o teste chame a API real ou o Banco real
jest.mock('../services/legalOneApiService');
jest.mock('@prisma/client', () => {
    const mPrisma = {
        user: {
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
        },
    };
    return { PrismaClient: jest.fn(() => mPrisma) };
});

// Acesso aos mocks para podermos verificar se foram chamados e definir retornos
const prisma = new PrismaClient();
const mockedGetContactGeneric = legalOneApiService.getContactGeneric as jest.Mock;

describe('syncParticipantsAsUsers', () => {
    
    beforeEach(() => {
        jest.clearAllMocks(); // Limpa a contagem dos mocks antes de cada teste
    });

    // Dados de exemplo para os testes
    const mockParticipant = {
        type: "Customer" as const,
        contactId: 100,
        contactName: "Cliente Teste",
        isMainParticipant: true
    };

    const mockLegalOneContact = {
        id: 100,
        name: "Cliente Teste",
        identificationNumber: "123.456.789-00", // CPF com máscara
        email: "teste@email.com",
        personStateIdentificationNumber: "12.345.678-9" // RG
    };

    // --- CENÁRIO 1: Lista Vazia ---
    it('deve retornar vazio se não houver participantes', async () => {
        const result = await syncParticipantsAsUsers([]);
        expect(result).toEqual([]);
        expect(prisma.user.findFirst).not.toHaveBeenCalled();
    });

    // --- CENÁRIO 2: Usuário Já Existe e Está Vinculado (Caminho Feliz) ---
    it('deve retornar o usuário existente se já estiver vinculado pelo ID do Legal One', async () => {
        // Simulamos que o banco encontrou o usuário pelo ID 100
        (prisma.user.findFirst as jest.Mock).mockResolvedValueOnce({ id: 'user-1', name: 'Já Existo' });

        const result = await syncParticipantsAsUsers([mockParticipant]);

        expect(prisma.user.findFirst).toHaveBeenCalledTimes(1); // Buscou no banco
        expect(legalOneApiService.getContactGeneric).not.toHaveBeenCalled(); // NÃO chamou a API (economia)
        expect(result[0].id).toBe('user-1');
    });

    // --- CENÁRIO 3: Usuário Existe por CPF mas não tem ID do Legal One (Merge) ---
    it('deve atualizar (vincular) o usuário se existir pelo CPF mas não pelo ID', async () => {
        // 1. Busca por ID -> Null (Não achou vínculo)
        (prisma.user.findFirst as jest.Mock).mockResolvedValueOnce(null);
        
        // 2. Mock da API retornando os dados (incluindo CPF)
        mockedGetContactGeneric.mockResolvedValue(mockLegalOneContact);

        // 3. Busca por CPF -> Encontra usuário desvinculado
        (prisma.user.findFirst as jest.Mock).mockResolvedValueOnce({ id: 'user-2', name: 'Existo Sem Vinculo', cpfOrCnpj: '12345678900' });

        // 4. Mock do Update
        (prisma.user.update as jest.Mock).mockResolvedValue({ id: 'user-2', legalOneContactId: 100 });

        await syncParticipantsAsUsers([mockParticipant]);

        expect(legalOneApiService.getContactGeneric).toHaveBeenCalledWith(100); // Foi na API buscar o CPF
        expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'user-2' },
            data: { legalOneContactId: 100 }
        }));
    });

    // --- CENÁRIO 4: Usuário Novo (Shadow User) ---
    it('deve criar um "Shadow User" se não existir nem por ID nem por CPF', async () => {
        // 1. Busca por ID -> Null
        (prisma.user.findFirst as jest.Mock).mockResolvedValueOnce(null);

        // 2. API retorna dados
        mockedGetContactGeneric.mockResolvedValue(mockLegalOneContact);

        // 3. Busca por CPF -> Null (Realmente é novo)
        (prisma.user.findFirst as jest.Mock).mockResolvedValueOnce(null);

        // 4. Mock do Create
        (prisma.user.create as jest.Mock).mockResolvedValue({ 
            id: 'new-user', 
            name: 'Cliente Teste', 
            status: 'ACTIVE' 
        });

        await syncParticipantsAsUsers([mockParticipant]);

        expect(prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                name: 'Cliente Teste',
                cpfOrCnpj: '12345678900', // Verifica se salvou sem máscara
                auth0UserId: 'legalone|import|100', // Verifica o ID Temporário
                status: 'ACTIVE',
                role: 'INVESTOR'
            })
        }));
    });
});