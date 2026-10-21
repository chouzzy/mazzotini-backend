import { parseReferenceMonth } from './calculationInput';

describe('parseReferenceMonth (mês de referência do POST /calculate)', () => {
    it('aceita ano e mês em número, como a tela manda, ou em texto com o número', () => {
        expect(parseReferenceMonth(2026, 11)).toEqual({ referenceYear: 2026, referenceMonth: 11 });
        expect(parseReferenceMonth('2023', '3')).toEqual({ referenceYear: 2023, referenceMonth: 3 });
    });

    it('sem os dois, usa o mês atual', () => {
        expect(parseReferenceMonth(undefined, undefined)).toEqual({});
        expect(parseReferenceMonth(null, '')).toEqual({});
    });

    it.each([
        ['só o ano', 2026, undefined],
        ['mês 13', 2026, 13],
        ['mês 0', 2026, 0],
        ['mês quebrado', 2026, 2.5],
        ['texto que não é número', '2026a', 3],
        ['ano fora da faixa', 20260, 3],
        ['valor booleano', 2026, true],
    ])('recusa %s', (_, year, month) => {
        expect(() => parseReferenceMonth(year, month))
            .toThrow('Mês de referência inválido. Escolha um mês válido ou deixe vazio para usar o mês atual.');
    });
});
