import axios from 'axios';
import { fetchIndexSeries, fetchTJSPSeries } from './ibgeService';

jest.mock('axios');
const mockedGet = axios.get as jest.Mock;

/** Resposta da API do BCB (SGS) para uma lista de [mês, ano, valor]. */
const bcb = (points: [number, number, string][]) => ({
    data: points.map(([month, year, valor]) => ({ data: `01/${String(month).padStart(2, '0')}/${year}`, valor })),
});

// Os valores são os publicados pelo BCB e batem com a tabela do TJSP (drcalc) no mês seguinte.
describe('fetchTJSPSeries', () => {
    beforeEach(() => mockedGet.mockReset());

    it('na virada da Lei 14.905, usa o INPC do mês anterior até a tabela de ago/2024 e o IPCA-15 depois', async () => {
        mockedGet.mockImplementation((url: string) => {
            if (url.includes('bcdata.sgs.188/')) return Promise.resolve(bcb([[6, 2024, '0.25'], [7, 2024, '0.26']]));
            if (url.includes('bcdata.sgs.7478/')) return Promise.resolve(bcb([[8, 2024, '0.19'], [9, 2024, '0.13']]));
            return Promise.reject(new Error(`URL inesperada: ${url}`));
        });

        const points = await fetchTJSPSeries(2024, 7, 2024, 10);

        expect(points).toEqual([
            { year: 2024, month: 7,  monthlyRate: 0.25 },
            { year: 2024, month: 8,  monthlyRate: 0.26 },
            { year: 2024, month: 9,  monthlyRate: 0.19 },
            { year: 2024, month: 10, monthlyRate: 0.13 },
        ]);
        const urls = mockedGet.mock.calls.map(call => call[0]);
        expect(urls).toEqual([
            expect.stringContaining('bcdata.sgs.188/dados?formato=json&dataInicial=01/06/2024&dataFinal=01/07/2024'),
            expect.stringContaining('bcdata.sgs.7478/dados?formato=json&dataInicial=01/08/2024&dataFinal=01/09/2024'),
        ]);
    });

    it('na virada do ano, a tabela de janeiro usa o IPCA-15 de dezembro', async () => {
        mockedGet.mockResolvedValue(bcb([[12, 2025, '0.25'], [1, 2026, '0.20'], [2, 2026, '0.84']]));

        const points = await fetchTJSPSeries(2026, 1, 2026, 3);

        expect(points).toEqual([
            { year: 2026, month: 1, monthlyRate: 0.25 },
            { year: 2026, month: 2, monthlyRate: 0.20 },
            { year: 2026, month: 3, monthlyRate: 0.84 },
        ]);
        expect(mockedGet).toHaveBeenCalledTimes(1);
        expect(mockedGet.mock.calls[0][0]).toContain('bcdata.sgs.7478/dados?formato=json&dataInicial=01/12/2025&dataFinal=01/02/2026');
    });

    it('antes da Lei 14.905, busca só o INPC', async () => {
        mockedGet.mockResolvedValue(bcb([[1, 2023, '0.46'], [2, 2023, '0.77']]));

        const points = await fetchTJSPSeries(2023, 2, 2023, 3);

        expect(points).toEqual([
            { year: 2023, month: 2, monthlyRate: 0.46 },
            { year: 2023, month: 3, monthlyRate: 0.77 },
        ]);
        expect(mockedGet).toHaveBeenCalledTimes(1);
        expect(mockedGet.mock.calls[0][0]).toContain('bcdata.sgs.188/dados?formato=json&dataInicial=01/01/2023&dataFinal=01/02/2023');
    });
});

describe('consulta ao BCB', () => {
    beforeEach(() => mockedGet.mockReset());
    afterEach(() => jest.useRealTimers());

    it('tenta de novo quando o BCB responde 502', async () => {
        jest.useFakeTimers();
        mockedGet
            .mockRejectedValueOnce({ response: { status: 502 } })
            .mockResolvedValueOnce(bcb([[9, 2026, '0.82']]));

        const result = fetchIndexSeries('IPCA', 2026, 9, 2026, 9);
        await jest.advanceTimersByTimeAsync(2000);

        await expect(result).resolves.toEqual([{ year: 2026, month: 9, monthlyRate: 0.82 }]);
        expect(mockedGet).toHaveBeenCalledTimes(2);
    });

    it('não repete o 404 de período ainda sem dado publicado', async () => {
        mockedGet.mockRejectedValue({ response: { status: 404 } });

        await expect(fetchIndexSeries('IPCA', 2026, 11, 2026, 11)).rejects.toEqual({ response: { status: 404 } });
        expect(mockedGet).toHaveBeenCalledTimes(1);
    });

    it('desiste depois de 4 tentativas', async () => {
        jest.useFakeTimers();
        mockedGet.mockRejectedValue({ response: { status: 503 } });

        const assertion = expect(fetchIndexSeries('IPCA', 2026, 9, 2026, 9)).rejects.toEqual({ response: { status: 503 } });
        await jest.advanceTimersByTimeAsync(2000 + 5000 + 15000);

        await assertion;
        expect(mockedGet).toHaveBeenCalledTimes(4);
    });
});
