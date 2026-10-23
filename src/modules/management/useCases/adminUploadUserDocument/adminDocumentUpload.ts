import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { MAX_FILE_SIZE_BYTES } from './AdminUploadUserDocumentUseCase';

/**
 * Recebe o arquivo do upload de documento do usuário pelo admin, em memória e até 10 MB (o limite
 * do use case). O tipo é conferido no use case, que responde 415.
 *
 * O multer comum das outras rotas recusava o WebP (que o use case aceita) com um erro simples, e o
 * arquivo acima de 150 MB também: os dois chegavam ao handler global como erro 500.
 */
const receive = multer({
    storage: multer.memoryStorage(),
    limits:  { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
}).single('document');

export function adminDocumentUpload(req: Request, res: Response, next: NextFunction) {
    receive(req, res, (err: unknown) => {
        if (!err) return next();
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ error: 'Arquivo muito grande. Tamanho máximo permitido: 10 MB.' });
        }
        // Arquivo em outro campo, mais de um arquivo ou envio corrompido
        console.warn('[ADMIN UPLOAD] Envio recusado:', (err as Error)?.message);
        return res.status(400).json({ error: 'Envio do arquivo recusado. Envie um arquivo por vez, no campo "document".' });
    });
}
