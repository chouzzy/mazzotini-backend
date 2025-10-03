// /src/modules/documents/useCases/getDownloadUrl/GetDownloadUrlController.ts
import { Request, Response } from 'express';
import { GetDownloadUrlUseCase } from './GetDownloadUrlUseCase';

class GetDownloadUrlController {
  async handle(request: Request, response: Response): Promise<Response> {
    const { id } = request.params;
    const useCase = new GetDownloadUrlUseCase();

    try {
      const url = await useCase.execute(id);
      return response.status(200).json({ url });
    } catch (err: any) {
      console.error(`[DOWNLOAD] Erro ao gerar URL para o documento ${id}:`, err.message);
      return response.status(404).json({ error: err.message });
    }
  }
}

export { GetDownloadUrlController };
