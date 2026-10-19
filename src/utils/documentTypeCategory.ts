/**
 * documentTypeCategory.ts — Categoria de um documento do Legal One a partir da hashtag
 *
 * O escritório marca o tipo de cada documento no Legal One com uma hashtag (#Cessão,
 * #HO, #Nfs-e...). A sincronização dos contratos usa este mapa para levar o documento
 * à área certa do app (documentos privados do cliente).
 *
 * A comparação ignora acento, maiúsculas, espaço, hífen e underline: "#Orientação
 * Financeira", "#orientacao_financeira" e "#OrientacaoFinanceira" dão no mesmo. Antes
 * a comparação era quase exata, e qualquer variação de digitação fazia o documento ser
 * ignorado sem aviso.
 */

const TYPE_TO_CATEGORY: Record<string, string> = {
    cessao:                 'CESSAO',
    ho:                     'HONORARIOS',
    honorarios:             'HONORARIOS',
    orientacaofinanceira:   'ORIENTACAO_FINANCEIRA',
    orientacoesfinanceiras: 'ORIENTACAO_FINANCEIRA',
    orientacaofiscal:       'ORIENTACAO_FISCAL',
    orientacoesfiscais:     'ORIENTACAO_FISCAL',
    notafiscal:             'NOTA_FISCAL',
    notasfiscais:           'NOTA_FISCAL',
    nfse:                   'NOTA_FISCAL', // "#Nfs-e", a hashtag que o escritório definiu para as notas fiscais
    comprovante:            'COMPROVANTE',
    comprovantes:           'COMPROVANTE',
};

/** "#Orientação Financeira" → "orientacaofinanceira"; "#Nfs-e" → "nfse". */
export function normalizeDocumentType(type: string): string {
    return type
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

/** Categoria do app para o tipo do documento, ou `null` se a hashtag não for reconhecida. */
export function mapDocumentTypeToCategory(type: string | null | undefined): string | null {
    if (!type) return null;
    return TYPE_TO_CATEGORY[normalizeDocumentType(type)] ?? null;
}
