import { Router, Request, Response } from 'express';

const protectedRoutes = Router();

/**
 * @route   GET /api/protected
 * @desc    Uma rota de exemplo que só pode ser acessada por usuários autenticados.
 * @access  Privado
 */
protectedRoutes.get('/protected', (request: Request, response: Response) => {
    // Se o código chegou até aqui, o middleware 'checkJwt' já validou o token.
    // As informações do usuário estão disponíveis em 'request.auth'.
    const auth0UserId = request.auth?.payload?.sub;

    return response.status(200).json({
        message: 'Você acessou uma rota protegida com sucesso!',
        userId: auth0UserId,
    });
});

export { protectedRoutes };
