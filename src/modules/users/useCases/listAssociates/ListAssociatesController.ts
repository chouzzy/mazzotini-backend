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
            const formattedAssociates = associates
                .sort((a, b) => {
                    if (a.associateSequence != null && b.associateSequence != null) return a.associateSequence - b.associateSequence;
                    if (a.associateSequence != null) return -1;
                    if (b.associateSequence != null) return 1;
                    return a.name.localeCompare(b.name);
                })
                .map(a => ({
                    value: a.id,
                    label: a.associateSequence != null
                        ? `${String(a.associateSequence).padStart(3, '0')} — ${a.name}`
                        : a.name,
                    associateSequence: a.associateSequence,
                    email: a.email,
                    role: a.role,
                }));

            return response.status(200).json(formattedAssociates);
        } catch (err: any) {
            console.error("[LIST ASSOCIATES] Erro ao buscar associados:", err.message);
            return response.status(500).json({ error: 'Erro interno ao buscar associados.' });
        }
    }
}

export { ListAssociatesController };
