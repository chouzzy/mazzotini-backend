import { Request, Response } from 'express';
import { CreateUserController } from './CreateUserController';

const mockExecute = jest.fn();

// O use case real cria um ManagementClient do Auth0 no import; o mock evita isso.
jest.mock('./CreateUserUseCase', () => ({
    CreateUserUseCase: jest.fn().mockImplementation(() => ({ execute: mockExecute })),
}));

describe('CreateUserController', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('devolve só o id, mesmo quando o e-mail já existia no banco', async () => {
        // Cadastro completo de quem já existia: nada disso pode sair na resposta.
        mockExecute.mockResolvedValue({
            id: 'user-1',
            email: 'cliente@exemplo.com',
            cpfOrCnpj: '123.456.789-00',
            rg: '12.345.678-9',
            residentialStreet: 'Rua Exemplo, 100',
        });

        const req = {
            body: { email: 'cliente@exemplo.com', name: 'Cliente', auth0UserId: 'auth0|123' },
        } as Request;
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;

        await new CreateUserController().handle(req, res);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({ id: 'user-1' });
    });
});
