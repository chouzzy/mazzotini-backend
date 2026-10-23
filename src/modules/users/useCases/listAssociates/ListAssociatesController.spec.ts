import { Request, Response } from 'express';
import { ListAssociatesController } from './ListAssociatesController';
import { ListAssociatesUseCase } from './ListAssociatesUseCase';

jest.mock('./ListAssociatesUseCase');

describe('ListAssociatesController', () => {
    it('lista os associados com o código, sem o e-mail', async () => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        (ListAssociatesUseCase as jest.Mock).mockImplementation(() => ({
            execute: jest.fn().mockResolvedValue([
                { id: 'associado-2', name: 'Associado Sem Código', associateSequence: null, email: 'b@exemplo.com', role: 'ASSOCIATE' },
                { id: 'associado-1', name: 'Associado Exemplo', associateSequence: 9, email: 'a@exemplo.com', role: 'ASSOCIATE' },
            ]),
        }));
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;

        await new ListAssociatesController().handle({} as Request, res);

        expect(res.status).toHaveBeenCalledWith(200);
        const body = (res.json as jest.Mock).mock.calls[0][0];
        expect(body.map((a: any) => a.label)).toEqual(['009 — Associado Exemplo', 'Associado Sem Código']);
        expect(body.every((a: any) => !('email' in a))).toBe(true);
    });
});
