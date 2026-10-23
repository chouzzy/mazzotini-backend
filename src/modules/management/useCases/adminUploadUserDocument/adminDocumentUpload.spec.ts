import express, { Request, Response } from 'express';
import request from 'supertest';
import { adminDocumentUpload } from './adminDocumentUpload';
import { AdminUploadUserDocumentController } from './AdminUploadUserDocumentController';

// Nada de banco, Spaces nem Legal One: o arquivo é recusado antes
jest.mock('@prisma/client', () => ({ PrismaClient: jest.fn(() => ({ user: { findUniqueOrThrow: jest.fn() } })) }));
jest.mock('../../../../services/fileUploadService', () => ({ fileUploadService: { upload: jest.fn() } }));
jest.mock('../../../../services/legalOneApiService', () => ({ legalOneApiService: {} }));

/** App mínimo: o envio do arquivo e, depois, o que chegou ao controller. */
const app = express();
app.post('/upload', adminDocumentUpload, (req: Request, res: Response) => {
    res.json({ size: req.file?.size, mimetype: req.file?.mimetype, inMemory: Buffer.isBuffer(req.file?.buffer) && !req.file?.path });
});

beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('adminDocumentUpload', () => {
    it('arquivo acima de 10 MB responde 413 (antes, 500)', async () => {
        const res = await request(app).post('/upload')
            .attach('document', Buffer.alloc(10 * 1024 * 1024 + 1), { filename: 'grande.pdf', contentType: 'application/pdf' });

        expect(res.status).toBe(413);
        expect(res.body).toEqual({ error: 'Arquivo muito grande. Tamanho máximo permitido: 10 MB.' });
    });

    it('WebP passa pelo envio, em memória: o tipo é conferido no use case (antes, 500)', async () => {
        const res = await request(app).post('/upload')
            .attach('document', Buffer.from('RIFF....WEBP'), { filename: 'foto.webp', contentType: 'image/webp' });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ size: 12, mimetype: 'image/webp', inMemory: true });
    });

    it('arquivo em outro campo responde 400', async () => {
        const res = await request(app).post('/upload')
            .attach('arquivo', Buffer.from('%PDF-1.4'), { filename: 'documento.pdf', contentType: 'application/pdf' });

        expect(res.status).toBe(400);
    });
});

describe('AdminUploadUserDocumentController', () => {
    it('DOCX responde 415, sem enviar nada', async () => {
        const req = {
            params: { id: '64b7f0c2a1b2c3d4e5f60a01' },
            file:   { mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 100, originalname: 'contrato.docx' },
        } as unknown as Request;
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;

        await new AdminUploadUserDocumentController().handle(req, res);

        expect(res.status).toHaveBeenCalledWith(415);
    });
});
