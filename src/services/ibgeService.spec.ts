import axios from 'axios';
import {
    fetchIndexSeries, fetchTaxaLegalSeries, fetchTaxaLegalTema1368Series, fetchTJMGSeries, fetchTJPRSeries, fetchTJSPSeries,
    TAXA_LEGAL_TEMA1368_MONTHS,
} from './ibgeService';

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

    it.each([
        ['429 (limite de requisições)', { response: { status: 429 } }],
        ['erro de rede, sem resposta',  { code: 'ECONNRESET' }],
    ])('tenta de novo em %s', async (_, error) => {
        jest.useFakeTimers();
        mockedGet
            .mockRejectedValueOnce(error)
            .mockResolvedValueOnce(bcb([[9, 2026, '0.82']]));

        const result = fetchIndexSeries('IPCA', 2026, 9, 2026, 9);
        await jest.advanceTimersByTimeAsync(2000);

        await expect(result).resolves.toEqual([{ year: 2026, month: 9, monthlyRate: 0.82 }]);
        expect(mockedGet).toHaveBeenCalledTimes(2);
    });

    it('tenta de novo quando o BCB devolve uma página no lugar da lista de dados', async () => {
        jest.useFakeTimers();
        mockedGet
            .mockResolvedValueOnce({ data: '<html>Serviço indisponível</html>' })
            .mockResolvedValueOnce(bcb([[9, 2026, '0.82']]));

        const result = fetchIndexSeries('IPCA', 2026, 9, 2026, 9);
        await jest.advanceTimersByTimeAsync(2000);

        await expect(result).resolves.toEqual([{ year: 2026, month: 9, monthlyRate: 0.82 }]);
    });
});

// Valores publicados pelo BCB; batem com a tabela da média INPC/IGP-DI e com os fatores do TJMG
describe('tabelas do TJPR e do TJMG', () => {
    beforeEach(() => mockedGet.mockReset());

    it('TJPR: média do INPC e do IGP-DI do mês anterior', async () => {
        mockedGet.mockImplementation((url: string) => {
            if (url.includes('bcdata.sgs.188/')) return Promise.resolve(bcb([[1, 2023, '0.46'], [2, 2023, '0.77']]));
            if (url.includes('bcdata.sgs.190/')) return Promise.resolve(bcb([[1, 2023, '0.06'], [2, 2023, '0.04']]));
            return Promise.reject(new Error(`URL inesperada: ${url}`));
        });

        const points = await fetchTJPRSeries(2023, 2, 2023, 3);

        expect(points).toEqual([
            { year: 2023, month: 2, monthlyRate: expect.closeTo(0.26, 10) },
            { year: 2023, month: 3, monthlyRate: expect.closeTo(0.405, 10) },
        ]);
        expect(mockedGet.mock.calls.map(call => call[0])).toEqual([
            expect.stringContaining('bcdata.sgs.188/dados?formato=json&dataInicial=01/01/2023&dataFinal=01/02/2023'),
            expect.stringContaining('bcdata.sgs.190/dados?formato=json&dataInicial=01/01/2023&dataFinal=01/02/2023'),
        ]);
    });

    it('TJPR: o mês só entra quando os dois índices já saíram', async () => {
        mockedGet.mockImplementation((url: string) => Promise.resolve(url.includes('bcdata.sgs.188/')
            ? bcb([[8, 2026, '0.10'], [9, 2026, '0.80']])   // INPC de setembro já saiu
            : bcb([[8, 2026, '0.30']])));                     // IGP-DI de setembro ainda não

        const points = await fetchTJPRSeries(2026, 9, 2026, 10);

        expect(points).toEqual([{ year: 2026, month: 9, monthlyRate: expect.closeTo(0.2, 10) }]);
    });

    it('TJMG: INPC do mês anterior', async () => {
        mockedGet.mockResolvedValue(bcb([[1, 2025, '0.00'], [2, 2025, '1.48']]));

        const points = await fetchTJMGSeries(2025, 2, 2025, 3);

        expect(points).toEqual([
            { year: 2025, month: 2, monthlyRate: 0 },
            { year: 2025, month: 3, monthlyRate: 1.48 },
        ]);
        expect(mockedGet).toHaveBeenCalledTimes(1);
        expect(mockedGet.mock.calls[0][0]).toContain('bcdata.sgs.188/dados?formato=json&dataInicial=01/01/2025&dataFinal=01/02/2025');
    });
});

describe('taxa legal (Res. CMN 5.171/2024)', () => {
    beforeEach(() => mockedGet.mockReset());

    it('lê a série oficial do BCB (SGS 29543), no mês da taxa', async () => {
        mockedGet.mockResolvedValue(bcb([[8, 2024, '0.605306'], [9, 2024, '0.676227'], [3, 2025, '0.000000']]));

        const points = await fetchTaxaLegalSeries(2024, 8, 2025, 3);

        expect(points).toEqual([
            { year: 2024, month: 8, monthlyRate: 0.605306 },
            { year: 2024, month: 9, monthlyRate: 0.676227 },
            { year: 2025, month: 3, monthlyRate: 0 },
        ]);
        expect(mockedGet).toHaveBeenCalledTimes(1);
        expect(mockedGet.mock.calls[0][0]).toContain('bcdata.sgs.29543/dados?formato=json&dataInicial=01/08/2024&dataFinal=01/03/2025');
    });
});

describe('taxa legal + Tema 1368 do STJ', () => {
    /** Meses de [mês, ano] até [mês, ano], inclusive. */
    const monthsBetween = ([m, y]: [number, number], [em, ey]: [number, number]) => {
        const list: [number, number][] = [];
        for (; y < ey || (y === ey && m <= em); m === 12 ? (y++, m = 1) : m++) list.push([m, y]);
        return list;
    };
    /** BCB fictício: SELIC mensal de 1% (1,47% em 12/2005), SELIC diária de 0,5% em dois dias de cada mês e IPCA-E de 0,5%. */
    const mockBCB = (ipcaE: Record<string, string> = {}, skipIpcaE?: string, skipSelic?: string) => mockedGet.mockImplementation((url: string) => {
        const range = url.match(/dataInicial=\d{2}\/(\d{2})\/(\d{4})&dataFinal=\d{2}\/(\d{2})\/(\d{4})/)!;
        const months = monthsBetween([+range[1], +range[2]], [+range[3], +range[4]]);
        const key = (m: number, y: number) => `${String(m).padStart(2, '0')}/${y}`;
        if (url.includes('bcdata.sgs.4390/')) {
            return Promise.resolve(bcb(months.filter(([m, y]) => key(m, y) !== skipSelic).map(([m, y]) => [m, y, key(m, y) === '12/2005' ? '1.47' : '1.00'])));
        }
        if (url.includes('bcdata.sgs.11/')) {
            return Promise.resolve({ data: months.flatMap(([m, y]) => ['01', '02'].map(d => ({ data: `${d}/${key(m, y)}`, valor: '0.500000' }))) });
        }
        if (url.includes('bcdata.sgs.10764/')) {
            return Promise.resolve(bcb(months.filter(([m, y]) => key(m, y) !== skipIpcaE).map(([m, y]) => [m, y, ipcaE[key(m, y)] ?? '0.50'])));
        }
        return Promise.reject(new Error(`URL inesperada: ${url}`));
    });

    beforeEach(() => mockedGet.mockReset());

    it('taxa do mês M pela SELIC e pelo IPCA-E de M-1, de 03/1995 a 07/2024, com a SELIC de 2 casas até 12/2005', async () => {
        mockBCB({ '12/2005': '0.38', '03/2006': '0.37', '06/2010': '2.00' });

        const points = await fetchTaxaLegalTema1368Series();
        const rate = (month: number, year: number) => points.find(p => p.year === year && p.month === month)?.monthlyRate;

        expect(points).toHaveLength(353);
        // A carga das séries vazias confere a série por esse total
        expect(TAXA_LEGAL_TEMA1368_MONTHS).toBe(points.length);
        expect(points[0]).toEqual({ year: 1995, month: 3, monthlyRate: expect.closeTo((1.01 / 1.005 - 1) * 100, 7) });
        expect(points[points.length - 1]).toMatchObject({ year: 2024, month: 7 });
        // 01/2006: SELIC de 12/2005 com 2 casas (1,47%) e IPCA-E de 0,38%, como no Dr. Calc (R$ 10,86 em R$ 1.000)
        expect(rate(1, 2006)).toBeCloseTo((1.0147 / 1.0038 - 1) * 100, 7);
        // 04/2006: SELIC de 03/2006 acumulada das taxas diárias
        expect(rate(4, 2006)).toBeCloseTo((1.005 * 1.005 / 1.0037 - 1) * 100, 6);
        // Nunca menor que zero
        expect(rate(7, 2010)).toBe(0);
        const urls = mockedGet.mock.calls.map(call => call[0]);
        expect(urls).toEqual([
            expect.stringContaining('bcdata.sgs.4390/dados?formato=json&dataInicial=01/02/1995&dataFinal=01/12/2005'),
            // A API do BCB devolve no máximo 10 anos de uma série diária por consulta
            expect.stringContaining('bcdata.sgs.11/dados?formato=json&dataInicial=01/01/2006&dataFinal=31/12/2015'),
            expect.stringContaining('bcdata.sgs.11/dados?formato=json&dataInicial=01/01/2016&dataFinal=30/06/2024'),
            expect.stringContaining('bcdata.sgs.10764/dados?formato=json&dataInicial=01/02/1995&dataFinal=01/06/2024'),
        ]);
    });

    it('falha inteira se faltar um mês, para não gravar a série pela metade', async () => {
        mockBCB({}, '05/2010');

        await expect(fetchTaxaLegalTema1368Series()).rejects.toThrow('Sem IPCA-E de 05/2010 no BCB.');

        mockBCB({}, undefined, '07/2003');
        await expect(fetchTaxaLegalTema1368Series()).rejects.toThrow('Sem SELIC de 07/2003 no BCB.');
    });
});
