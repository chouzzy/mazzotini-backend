import { saoPauloDateParts } from './saoPauloDate';

describe('saoPauloDateParts', () => {
    it('às 22h de 31/10 em Brasília, o mês ainda é outubro, embora em UTC já seja novembro', () => {
        expect(saoPauloDateParts(new Date('2026-11-01T01:00:00.000Z'))).toEqual({ year: 2026, month: 10, day: 31, hour: 22 });
    });

    it('a virada do ano também é a de Brasília', () => {
        expect(saoPauloDateParts(new Date('2027-01-01T02:59:00.000Z'))).toMatchObject({ year: 2026, month: 12, day: 31, hour: 23 });
        expect(saoPauloDateParts(new Date('2027-01-01T03:00:00.000Z'))).toMatchObject({ year: 2027, month: 1, day: 1, hour: 0 });
    });
});
