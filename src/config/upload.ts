import multer from 'multer';
import crypto from 'crypto';
import path from 'path';

// Define o caminho da pasta temporária na raiz do projeto
const tmpFolder = path.resolve(__dirname, '..', '..', 'tmp');

export default {
    directory: tmpFolder,
    
    // Configura o armazenamento temporário em disco
    storage: multer.diskStorage({
        destination: tmpFolder,
        filename(request, file, callback) {
            // Gera um hash para evitar nomes de arquivos duplicados
            const fileHash = crypto.randomBytes(10).toString('hex');
            
            // Sanitiza o nome original para evitar problemas com caracteres especiais
            // (Opcional, mas recomendado)
            const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
            
            const fileName = `${fileHash}-${sanitizedName}`;
            
            return callback(null, fileName);
        },
    }),

    // Limites de segurança
    limits: {
        fileSize: 150 * 1024 * 1024,
    },

    fileFilter(request: any, file: Express.Multer.File, callback: multer.FileFilterCallback) {
        const allowed = [
            'application/pdf',
            'image/jpeg',
            'image/png',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];
        if (allowed.includes(file.mimetype)) {
            callback(null, true);
        } else {
            callback(new Error(`Tipo de arquivo não permitido: ${file.mimetype}`));
        }
    },
};