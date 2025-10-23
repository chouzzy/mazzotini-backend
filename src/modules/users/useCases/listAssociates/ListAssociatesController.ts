// /src/modules/users/useCases/listAssociates/ListAssociatesController.ts
import { Request, Response } from 'express';
import { ListAssociatesUseCase } from './ListAssociatesUseCase';

class ListAssociatesController {
    async handle(request: Request, response: Response): Promise<Response> {
        const useCase = new ListAssociatesUseCase();
        try {
            const associates = await useCase.execute();
            
            // A API do Chakra Select espera um formato { value, label }
            // Formatamos os dados aqui para poupar trabalho ao frontend.
            const formattedAssociates = associates.map(a => ({
                value: a.id,
                label: a.name
            }));
            
            return response.status(200).json(formattedAssociates);
        } catch (err: any) {
            console.error("[LIST ASSOCIATES] Erro ao buscar associados:", err.message);
            return response.status(500).json({ error: 'Erro interno ao buscar associados.' });
        }
    }
}

export { ListAssociatesController };
