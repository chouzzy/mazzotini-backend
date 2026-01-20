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
}