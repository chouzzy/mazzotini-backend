import axios, { AxiosInstance } from 'axios';

export class LegalOneAuth {
    protected accessToken: string | null = null;
    protected tokenExpiresAt: number | null = null;

    protected async getAccessToken(): Promise<string> {
        if (this.accessToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt) {
            return this.accessToken;
        }

        console.log("[Legal One API] Obtendo novo token de acesso...");
        const key = process.env.LEGAL_ONE_CONSUMER_KEY;
        const secret = process.env.LEGAL_ONE_CONSUMER_SECRET;
        const baseUrl = process.env.LEGAL_ONE_API_BASE_URL;

        if (!key || !secret || !baseUrl) throw new Error("Credenciais não configuradas.");
        
        const tokenUrl = `${baseUrl}/oauth?grant_type=client_credentials`;
        const response = await axios.get(tokenUrl, {
            headers: { 'Authorization': `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}` }
        });

        const { access_token, expires_in } = response.data;
        this.accessToken = access_token;
        this.tokenExpiresAt = Date.now() + (expires_in - 60) * 1000;
        
        return this.accessToken as string;
    }

    protected async getAuthHeader(): Promise<{ Authorization: string, 'Content-Type'?: string }> {
        const token = await this.getAccessToken();
        return { Authorization: `Bearer ${token}` };
    }

    /**
     * Helper para lidar com Rate Limit (429) usando Exponential Backoff.
     * Fica na classe base para todos os serviços do Legal One poderem usar.
     */
    protected async requestWithRetry<T>(requestFn: () => Promise<T>, maxRetries = 5): Promise<T> {
        let attempt = 0;
        let baseDelay = 2000; // Começa a esperar 2 segundos

        while (attempt < maxRetries) {
            try {
                // Tenta executar a requisição Axios
                return await requestFn();
            } catch (error: any) {
                // Se o erro for 429 (Too Many Requests)
                if (error.response && error.response.status === 429) {
                    attempt++;
                    console.warn(`[RATE LIMIT] ⚠️ 429 Too Many Requests. Tentativa ${attempt}/${maxRetries}...`);

                    if (attempt >= maxRetries) {
                        console.error(`[RATE LIMIT] ❌ Limite de tentativas excedido.`);
                        throw error;
                    }

                    // Verifica se a API informou quanto tempo devemos esperar (header Retry-After)
                    const retryAfter = error.response.headers['retry-after'];

                    // Se tiver header, usa ele. Se não, dobra o tempo de espera (2s, 4s, 8s, 16s...)
                    const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : baseDelay * Math.pow(2, attempt - 1);

                    console.log(`[RATE LIMIT] ⏳ Aguardando ${waitTime / 1000} segundos antes de tentar de novo...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                } else {
                    // Se for um erro 404, 500, etc., lança o erro normalmente para não mascarar outros problemas
                    throw error;
                }
            }
        }
        throw new Error("Unreachable");
    }
}
