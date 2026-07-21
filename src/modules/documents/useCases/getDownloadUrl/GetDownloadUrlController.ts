// /src/modules/documents/useCases/getDownloadUrl/GetDownloadUrlController.ts
import { Request, Response } from 'express';
import { GetDownloadUrlUseCase } from './GetDownloadUrlUseCase';

class GetDownloadUrlController {
  async handle(request: Request, response: Response): Promise<Response> {
    const id = request.params.id as string;
    const auth0UserId = (request as any).auth?.payload?.sub as string;
    const useCase = new GetDownloadUrlUseCase();

    try {
      const url = await useCase.execute(id, auth0UserId);
      return response.status(200).json({ url });
    } catch (err: any) {
      console.error(`[DOWNLOAD] Erro ao gerar URL para o documento ${id}:`, err.message);
      const status = err.message.includes('permissão') ? 403 : 404;
      return response.status(status).json({ error: err.message });
    }
  }
}

export { GetDownloadUrlController };
