// /src/modules/management/useCases/inviteUser/InviteUserController.ts
import { Request, Response } from 'express';
import { InviteUserUseCase } from './InviteUserUseCase';
import * as yup from 'yup';

class InviteUserController {
    async handle(request: Request, response: Response): Promise<Response> {
        // Validação dos dados de entrada
        const validationSchema = yup.object().shape({
            email: yup.string().email("Formato de e-mail inválido.").required("O e-mail é obrigatório."),
            name: yup.string().required("O nome é obrigatório."),
            initialRole: yup.string().required("A role inicial é obrigatória."),
        });

        try {
            await validationSchema.validate(request.body, { abortEarly: false });
        } catch (err: any) {
            return response.status(400).json({ error: 'Erro de validação.', details: err.errors });
        }

        const { email, name, initialRole } = request.body;
        const useCase = new InviteUserUseCase();

        try {
            await useCase.execute({ email, name, initialRole });
            return response.status(201).json({ message: `Convite enviado com sucesso para ${email}.` });
        } catch (err: any) {
            console.error("[INVITE USER] Erro ao processar convite:", err.message);
            return response.status(500).json({ error: err.message });
        }
    }
}

export { InviteUserController };
