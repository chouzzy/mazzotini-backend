import { VISIBLE_UPDATES_FILTER, parseAndCleanDescription } from './updateDescriptionParser';

type UpdateRow = { description: string; source: string };

/** Avalia o filtro como o Prisma faz para cláusulas `contains` (as únicas usadas nele). */
const isVisible = (row: UpdateRow) =>
    (VISIBLE_UPDATES_FILTER.OR as Array<Record<string, { contains: string }>>).some(clause =>
        Object.entries(clause).every(([field, condition]) =>
            row[field as keyof UpdateRow].includes(condition.contains)));

describe('VISIBLE_UPDATES_FILTER', () => {

    it('mostra o andamento gravado pelo enrichment (texto limpo, tag só em source)', () => {
        const raw = '#RelatórioMAA\nValor Atualizado: R$ 127.300,00\nAudiência de instrução realizada.';
        const { cleanedText } = parseAndCleanDescription(raw);

        // É exatamente o que o EnrichAssetFromLegalOneUseCase grava
        const row = { description: cleanedText, source: 'Legal One - Manual - #RelatórioMAA' };

        expect(cleanedText).not.toContain('#RelatórioMAA');
        expect(isVisible(row)).toBe(true);
    });

    it('mostra o andamento gravado pelos syncs (texto bruto, com a tag)', () => {
        expect(isVisible({ description: '#RelatórioMAA\nPerícia concluída.', source: 'Legal One - Manual' })).toBe(true);
        expect(isVisible({ description: '#RelatorioMAA\nPerícia concluída.', source: 'Legal One - Manual' })).toBe(true);
    });

    it('continua escondendo andamentos sem a tag', () => {
        expect(isVisible({ description: 'Juntada de petição.', source: 'Legal One - Manual' })).toBe(false);
        expect(isVisible({ description: 'Correção automática: IPCA 0,52%', source: 'Sistema - Correção Mensal' })).toBe(false);
    });
});
