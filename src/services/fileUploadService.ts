// /src/services/fileUploadService.ts
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// Configuração do Cliente S3 para o DigitalOcean Spaces
const spacesEndpoint = process.env.SPACES_ENDPOINT!; // ex: "nyc3.digitaloceanspaces.com"
const region = spacesEndpoint.split('.')[0]; // ex: "nyc3"
const accessKeyId = process.env.SPACES_ACCESS_KEY!;
const secretAccessKey = process.env.SPACES_SECRET_KEY!;
const bucketName = process.env.SPACES_BUCKET_NAME!;

// NOVO: Lê a pasta raiz específica desta aplicação a partir das variáveis de ambiente
const appFolder = process.env.SPACES_APP_FOLDER || 'mazzotini-dev'; // 'mazzotini-dev' como fallback

if (!spacesEndpoint || !accessKeyId || !secretAccessKey || !bucketName) {
    console.warn("[File Service] As credenciais do DigitalOcean Spaces não estão configuradas. O upload de ficheiros está desativado.");
}

const s3Client = new S3Client({
    endpoint: `https://${spacesEndpoint}`, // A URL completa da API
    region: region,
    credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey
    }
});

/**
 * @class FileUploadService
 * @description Encapsula a lógica de upload de ficheiros para o DO Spaces.
 */
class FileUploadService {
    /**
     * Faz o upload de um ficheiro a partir de um buffer de memória.
     * @param buffer O buffer do ficheiro.
     * @param fileName O nome do ficheiro a ser guardado.
     * @param folder A sub-pasta (ex: "users/id-do-user/profile_picture").
     * @param mimeType O tipo do ficheiro (ex: "image/jpeg").
     * @returns A URL pública e permanente do ficheiro.
     */
    async upload(buffer: Buffer, fileName: string, folder: string, mimeType: string): Promise<string> {
        if (!accessKeyId) {
            throw new Error("Serviço de upload não configurado.");
        }

        // O caminho agora inclui a pasta raiz da aplicação
        const key = `${appFolder}/${folder}/${Date.now()}-${fileName}`;

        const params = new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: buffer,
            ContentType: mimeType,
            ACL: 'public-read', // Torna o ficheiro publicamente acessível
        });

        await s3Client.send(params);

        // A URL pública é composta pelo nome do bucket, endpoint e a chave do ficheiro
        const fileUrl = `https://${bucketName}.${spacesEndpoint}/${key}`;
        
        console.log(`[File Service] Ficheiro ${key} enviado com sucesso.`);
        return fileUrl;
    }
}

export const fileUploadService = new FileUploadService();

