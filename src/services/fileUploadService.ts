import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
// CORREÇÃO: Usamos a lib-storage para uploads mais robustos e sem o warning de stream
import { Upload } from "@aws-sdk/lib-storage"; 
import fs from 'fs'; // Necessário para ler o arquivo do disco

// Configuração do Cliente S3 para o DigitalOcean Spaces
const spacesEndpoint = process.env.SPACES_ENDPOINT!; 
const region = spacesEndpoint.split('.')[0]; 
const accessKeyId = process.env.SPACES_ACCESS_KEY!;
const secretAccessKey = process.env.SPACES_SECRET_KEY!;
const bucketName = process.env.SPACES_BUCKET_NAME!;

// ATENÇÃO: Se não houver variável, ele cai para o 'mazzotini-dev'
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

class FileUploadService {
    /**
     * Sanitiza o nome do arquivo
     */
    private sanitizeFileName(fileName: string): string {
        return fileName
            .normalize("NFD") 
            .replace(/[\u0300-\u036f]/g, "") 
            .replace(/\s+/g, '-') 
            .replace(/[^a-zA-Z0-9.-]/g, ''); 
    }

    /**
     * Faz o upload de um ficheiro usando @aws-sdk/lib-storage.
     * Suporta Buffer (memoryStorage) ou String/Path (diskStorage).
     */
    async upload(fileContent: Buffer | string, fileName: string, folder: string, mimeType: string): Promise<string> {
        console.log('[File Service] Iniciando upload com os seguintes parâmetros:');
        console.log({ fileName, folder, mimeType, fileContent: typeof fileContent });

        if (!accessKeyId) {
            console.error("[File Service] Serviço de upload não configurado. 'accessKeyId' está em falta.");
            throw new Error("Serviço de upload não configurado.");
        }

        // Validação para evitar o erro "undefined reading stream"
        if (!fileContent) {
            console.error("[File Service] Conteúdo do arquivo inválido.");
            throw new Error("Conteúdo do arquivo inválido. Se estiver usando diskStorage, envie 'file.path'. Se memoryStorage, envie 'file.buffer'.");
        }

        const cleanName = this.sanitizeFileName(fileName);
        console.log(`[File Service] Nome do ficheiro original: "${fileName}", Nome sanitizado: "${cleanName}"`);

        const key = `${appFolder}/${folder}/${Date.now()}-${cleanName}`;
        console.log(`[File Service] Chave gerada para o S3: ${key}`);

        // Prepara o corpo do upload (Stream ou Buffer)
        let body;
        if (typeof fileContent === 'string') {
            // Se for string, assume que é um caminho (diskStorage) e cria um Stream
            console.log(`[File Service] Lendo arquivo do disco (diskStorage): ${fileContent}`);
            body = fs.createReadStream(fileContent);
        } else {
            // Se for Buffer (memoryStorage)
            console.log('[File Service] Usando Buffer em memória (memoryStorage).');
            body = fileContent;
        }

        try {
            const uploadParams = {
                Bucket: bucketName,
                Key: key,
                Body: body,
                ContentType: mimeType,
                ACL: 'public-read' as const,
            };
            console.log('[File Service] Parâmetros para o upload S3:', uploadParams);

            const parallelUploads3 = new Upload({
                client: s3Client,
                params: uploadParams,
                queueSize: 4,
                partSize: 1024 * 1024 * 5,
            });

            console.log('[File Service] A iniciar o processo de upload para o S3...');
            await parallelUploads3.done();
            console.log('[File Service] Upload para o S3 concluído com sucesso.');

            const fileUrl = `https://${bucketName}.${spacesEndpoint}/${key}`;
            console.log(`[File Service] Ficheiro enviado para: ${fileUrl}`);

            // Opcional: Se usou disco, o arquivo temporário ainda está lá. 
            // O Multer geralmente limpa automaticamente no final da requisição, 
            // mas se não limpar, seria bom fazer fs.unlink(fileContent) aqui.

            console.log('[File Service] Retornando a URL do ficheiro.');
            return fileUrl;

        } catch (e: any) {
            console.error("[File Service] Erro no upload:", e);
            throw new Error("Falha no upload para o Spaces.");
        }
    }

    /**
     * Remove um ficheiro do Spaces baseado na sua URL pública.
     */
    async deleteFile(fileUrl: string): Promise<void> {
        if (!fileUrl) return;

        try {
            const urlObj = new URL(fileUrl);
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
        }
    }
}

export const fileUploadService = new FileUploadService();