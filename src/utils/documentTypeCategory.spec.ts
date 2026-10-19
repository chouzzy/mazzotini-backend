import { mapDocumentTypeToCategory } from './documentTypeCategory';

describe('mapDocumentTypeToCategory', () => {
    it.each([
        ['#Nfs-e', 'NOTA_FISCAL'],
        ['#NFS-e', 'NOTA_FISCAL'],
        ['#nfse', 'NOTA_FISCAL'],
        ['#Notas Fiscais', 'NOTA_FISCAL'],
        ['#Orientação Financeira', 'ORIENTACAO_FINANCEIRA'],
        ['#orientacao_financeira', 'ORIENTACAO_FINANCEIRA'],
        ['#OrientaçãoFinanceira', 'ORIENTACAO_FINANCEIRA'],
        ['#Orientação fiscal', 'ORIENTACAO_FISCAL'],
        ['#Comprovantes', 'COMPROVANTE'],
        ['#Comprovante', 'COMPROVANTE'],
    ])('reconhece %s', (type, category) => {
        expect(mapDocumentTypeToCategory(type)).toBe(category);
    });

    it.each([
        ['#Cessão', 'CESSAO'],
        ['#Cessao', 'CESSAO'],
        ['#HO', 'HONORARIOS'],
        ['#Honorários', 'HONORARIOS'],
        ['#Nota Fiscal', 'NOTA_FISCAL'],
    ])('continua reconhecendo os tipos que já existiam: %s', (type, category) => {
        expect(mapDocumentTypeToCategory(type)).toBe(category);
    });

    it('ignora hashtag desconhecida e tipo vazio', () => {
        expect(mapDocumentTypeToCategory('#DocumentoMAA')).toBeNull();
        expect(mapDocumentTypeToCategory('')).toBeNull();
        expect(mapDocumentTypeToCategory(null)).toBeNull();
    });
});
