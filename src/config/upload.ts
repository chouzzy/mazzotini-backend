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
        // Limite de 150MB por arquivo (em bytes)
        fileSize: 150 * 1024 * 1024, 
    },
};