import { Request, Response } from 'express';
import { AdminUpdateUserController } from './AdminUpdateUserController';

const mockExecute = jest.fn();

jest.mock('./AdminUpdateUserUseCase', () => ({
    AdminUpdateUserUseCase: jest.fn().mockImplementation(() => ({ execute: mockExecute })),
}));

// Campos obrigatórios do formulário, com dados fictícios
const baseBody = {
    name: 'Cliente Exemplo',
    cpfOrCnpj: '00000000000',
    cellPhone: '11900000000',
    residentialCep: '01000000',
    residentialStreet: 'Rua Exemplo',
    residentialNumber: '100',
    residentialNeighborhood: 'Centro',
    residentialCity: 'São Paulo',
    residentialState: 'SP',
};

/** Chama o controller e devolve o `data` que chegou no use case. */
const run = async (body: Record<string, unknown>) => {
    const req = { params: { id: 'user-1' }, body } as unknown as Request;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
    await new AdminUpdateUserController().handle(req, res);
    return { res, data: mockExecute.mock.calls[0]?.[1] };
};

describe('AdminUpdateUserController', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockExecute.mockResolvedValue({ id: 'user-1' });
    });

    it('mantém o null da indicação que não está em uso, para limpar o campo', async () => {
        const { data } = await run({ ...baseBody, referredById: null, indication: 'Indicação Manual' });

        expect(data).toMatchObject({ referredById: null, indication: 'Indicação Manual' });
    });

    it('indicação vazia vira null', async () => {
        const { data } = await run({ ...baseBody, referredById: 'associado-2', indication: '' });

        expect(data).toMatchObject({ referredById: 'associado-2', indication: null });
    });

    it('pede para descartar as solicitações pendentes, porque a edição vale na hora', async () => {
        await run({ ...baseBody });

        expect(mockExecute).toHaveBeenCalledWith('user-1', expect.any(Object), { supersedePendingRequests: true });
    });

    it('continua descartando os outros campos vazios', async () => {
        const { data } = await run({ ...baseBody, rg: '', phone: null });

        expect(data).not.toHaveProperty('rg');
        expect(data).not.toHaveProperty('phone');
    });
});
