import axios from 'axios';
import { LegalOneDocuments } from './LegalOneDocuments';

jest.mock('axios');
const mockedGet = axios.get as jest.Mock;

describe('LegalOneDocuments.getPrivateDocuments', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        // Valores fictícios: o .env.test deixa as credenciais do Legal One vazias
        process.env.LEGAL_ONE_API_BASE_URL = 'https://legalone.exemplo';
        process.env.LEGAL_ONE_CONSUMER_KEY = 'chave-ficticia';
        process.env.LEGAL_ONE_CONSUMER_SECRET = 'segredo-ficticio';
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        mockedGet.mockReset();
    });

    afterEach(() => {
        process.env = { ...originalEnv };
        jest.restoreAllMocks();
    });

    it('repete a página quando o Legal One responde 429', async () => {
        mockedGet
            .mockResolvedValueOnce({ data: { access_token: 'token-ficticio', expires_in: 3600 } })
            .mockRejectedValueOnce({ response: { status: 429, headers: { 'retry-after': '0' } } })
            .mockResolvedValueOnce({ data: { value: [{ id: 1, type: '#Nfs-e' }] } });

        const docs = await new LegalOneDocuments().getPrivateDocuments();

        expect(docs).toEqual([{ id: 1, type: '#Nfs-e' }]);
        expect(mockedGet).toHaveBeenCalledTimes(3); // token + página com 429 + a mesma página de novo
    });

    it('segue as próximas páginas até o fim', async () => {
        mockedGet
            .mockResolvedValueOnce({ data: { access_token: 'token-ficticio', expires_in: 3600 } })
            .mockResolvedValueOnce({ data: { value: [{ id: 1 }], '@odata.nextLink': 'https://legalone.exemplo/pagina-2' } })
            .mockResolvedValueOnce({ data: { value: [{ id: 2 }] } });

        const docs = await new LegalOneDocuments().getPrivateDocuments();

        expect(docs.map(d => d.id)).toEqual([1, 2]);
    });
});
