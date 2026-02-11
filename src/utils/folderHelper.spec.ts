import { ensureProcessFolderExists } from './folderHelper';
import { PrismaClient } from '@prisma/client';

// 1. Mock do Prisma
jest.mock('@prisma/client', () => {
    const mPrisma = {
        processFolder: {
            findUnique: jest.fn(),
            create: jest.fn(),
        },
    };
    return { PrismaClient: jest.fn(() => mPrisma) };
});

const prisma = new PrismaClient();

describe('folderHelper - ensureProcessFolderExists', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // CENÁRIO 1: Inputs inválidos
    it('deve retornar null se não houver código de pasta', async () => {
        const result = await ensureProcessFolderExists(null);
        expect(result).toBeNull();
    });

    // CENÁRIO 2: Pasta já existe (Caminho Feliz)
    it('deve retornar o ID da pasta existente se ela já estiver no banco', async () => {
        const mockFolder = { id: 'folder-123', folderCode: 'Proc - 0002356' };
        
        // Mock do findUnique retornando a pasta
        (prisma.processFolder.findUnique as jest.Mock).mockResolvedValue(mockFolder);

        // Passamos um código com sufixo (/001) para testar se ele limpa
        const result = await ensureProcessFolderExists('Proc - 0002356/001', 'Título do Processo');

        // Verifica se limpou o sufixo na busca
        expect(prisma.processFolder.findUnique).toHaveBeenCalledWith({
            where: { folderCode: 'Proc - 0002356' }
        });
        
        // Não deve tentar criar
        expect(prisma.processFolder.create).not.toHaveBeenCalled();
        expect(result).toBe('folder-123');
    });

    // CENÁRIO 3: Pasta não existe (Criação)
    it('deve criar uma nova pasta se ela não existir', async () => {
        // Mock do findUnique retornando null (não existe)
        (prisma.processFolder.findUnique as jest.Mock).mockResolvedValue(null);
        
        // Mock do create retornando a nova pasta
        (prisma.processFolder.create as jest.Mock).mockResolvedValue({ id: 'new-folder-456' });

        const rawCode = 'Proc - 999999/003';
        const title = 'Ação de Execução';

        const result = await ensureProcessFolderExists(rawCode, title);

        // Verifica a lógica de limpeza
        const cleanCode = 'Proc - 999999';

        expect(prisma.processFolder.findUnique).toHaveBeenCalledWith({ where: { folderCode: cleanCode } });
        
        expect(prisma.processFolder.create).toHaveBeenCalledWith({
            data: {
                folderCode: cleanCode,
                description: title
            }
        });

        expect(result).toBe('new-folder-456');
    });

    // CENÁRIO 4: Concorrência / Erro (Fallback)
    it('deve tentar buscar novamente se a criação falhar (ex: race condition)', async () => {
        const cleanCode = 'Proc - 888';

        // 1. Não acha
        (prisma.processFolder.findUnique as jest.Mock).mockResolvedValueOnce(null);
        
        // 2. Tenta criar e falha (simulando erro de Unique Constraint porque outro processo criou milissegundos antes)
        (prisma.processFolder.create as jest.Mock).mockRejectedValue(new Error('Unique constraint failed'));

        // 3. O catch chama o findUnique de novo (Fallback)
        (prisma.processFolder.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'folder-recovered-789' });

        const result = await ensureProcessFolderExists(cleanCode, 'Título');

        expect(prisma.processFolder.create).toHaveBeenCalled();
        expect(prisma.processFolder.findUnique).toHaveBeenCalledTimes(2); // Chamou 2 vezes
        expect(result).toBe('folder-recovered-789');
    });
});