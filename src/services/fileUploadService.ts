import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"; // Adicionado DeleteObjectCommand

// Configuração do Cliente S3 para o DigitalOcean Spaces
const spacesEndpoint = process.env.SPACES_ENDPOINT!; 
const region = spacesEndpoint.split('.')[0]; 
const accessKeyId = process.env.SPACES_ACCESS_KEY!;
const secretAccessKey = process.env.SPACES_SECRET_KEY!;
const bucketName = process.env.SPACES_BUCKET_NAME!;

const appFolder = process.env.SPACES_APP_FOLDER || 'mazzotini-dev';

if (!spacesEndpoint || !accessKeyId || !secretAccessKey || !bucketName) {
    console.warn("[File Service] As credenciais do DigitalOcean Spaces não estão configuradas.");
}

const s3Client = new S3Client({
    endpoint: `https://${spacesEndpoint}`,
    region: region,
    credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey
    }
});

/**
 * @class FileUploadService
 * @description Encapsula a lógica de upload e remoção de ficheiros no DO Spaces.
 */
class FileUploadService {
    /**
     * Faz o upload de um ficheiro a partir de um buffer de memória.
     */
    async upload(buffer: Buffer, fileName: string, folder: string, mimeType: string): Promise<string> {
        if (!accessKeyId) {
            throw new Error("Serviço de upload não configurado.");
        }

        const key = `${appFolder}/${folder}/${Date.now()}-${fileName}`;

        const params = new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: buffer,
            ContentType: mimeType,
            ACL: 'public-read', 
        });

        await s3Client.send(params);

        const fileUrl = `https://${bucketName}.${spacesEndpoint}/${key}`;
        
        console.log(`[File Service] Ficheiro ${key} enviado com sucesso.`);
        return fileUrl;
    }

    // =================================================================
    //  NOVO MÉTODO: DELETE
    // =================================================================
    /**
     * Remove um ficheiro do Spaces baseado na sua URL pública.
     * @param fileUrl A URL completa do ficheiro (ex: https://bucket.../pasta/arquivo.jpg)
     */
    async deleteFile(fileUrl: string): Promise<void> {
        if (!fileUrl) return;

        try {
            // 1. Extrair a "Key" (o caminho relativo) da URL
            // URL: https://bucket.nyc3.digitaloceanspaces.com/mazzotini-dev/users/123/arquivo.pdf
            // Key esperada: mazzotini-dev/users/123/arquivo.pdf
            
            const urlObj = new URL(fileUrl);
            // O pathname vem com uma barra inicial (ex: /mazzotini-dev...), removemos com substring(1)
            // Também decodificamos caso tenha espaços (%20) ou caracteres especiais
            const key = decodeURIComponent(urlObj.pathname.substring(1));

            console.log(`[File Service] A tentar excluir ficheiro com Key: ${key}`);

            const params = new DeleteObjectCommand({
                Bucket: bucketName,
                Key: key,
            });

            await s3Client.send(params);
            console.log(`[File Service] Ficheiro excluído do Spaces com sucesso.`);

        } catch (error: any) {
            console.error(`[File Service] Erro ao excluir ficheiro ${fileUrl}:`, error.message);
            // Não lançamos erro para não quebrar o fluxo do banco de dados, 
            // mas logamos para auditoria.
        }
    }
}

export const fileUploadService = new FileUploadService();