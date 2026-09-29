/**
 * updateDescriptionParser.ts — Leitura dos andamentos #RelatórioMAA do Legal One
 *
 * ## Por que existe
 * `EnrichAssetFromLegalOneUseCase` chamava `parseAndCleanDescription`, mas a
 * função só existia como `declare function` — uma declaração de tipo, sem
 * implementação. O TypeScript compilava; em runtime estourava
 * `ReferenceError: parseAndCleanDescription is not defined`.
 *
 * O efeito era silencioso e seletivo: processos SEM andamento marcado saíam por
 * um `return` antecipado e enriqueciam normalmente, enquanto os que TINHAM
 * andamento — justamente os que carregam valor e histórico — estouravam sempre
 * e eram marcados como FAILED_ENRICHMENT. Como o ativo falho nunca era
 * reprocessado, a falha virava permanente.
 *
 * `extractAllValues` veio de SyncProcessUpdatesUseCase, onde já rodava em
 * produção. Ficou aqui para que os dois caminhos leiam o mesmo formato — a
 * divergência entre eles foi o que produziu este bug.
 */

export const TAG_RELATORIO = '#RelatórioMAA';

export interface ExtractedValues {
    valorDaCausa: number | null;
    valorDaCompra: number | null;
    valorAtualizado: number | null;
}

/**
 * Extrai os valores monetários declarados no corpo do andamento.
 *
 * Formato esperado (pt-BR): `Valor Atualizado: R$ 1.234.567,89`
 * Milhar com ponto, decimal com vírgula.
 */
export function extractAllValues(text: string | null | undefined): ExtractedValues {
    if (!text) return { valorDaCausa: null, valorDaCompra: null, valorAtualizado: null };

    const parse = (match: RegExpMatchArray | null, truncate = false): number | null => {
        if (match && match[1]) {
            const numericString = match[1].replace(/\./g, '').replace(',', '.');
            const value = parseFloat(numericString);
            if (Number.isNaN(value)) return null;
            return truncate ? Math.trunc(value) : value;
        }
        return null;
    };

    return {
        valorDaCausa: parse(text.match(/Valor da Causa:\s*R\$\s*([\d.,]+)/i)),
        // Truncado por decisão de negócio herdada do sync diário.
        valorDaCompra: parse(text.match(/Valor da Compra:\s*R\$\s*([\d.,]+)/i), true),
        valorAtualizado: parse(text.match(/Valor Atualizado:\s*R\$\s*([\d.,]+)/i)),
    };
}

export interface ParsedDescription {
    /** Valor Atualizado do andamento, quando declarado. */
    value: number | null;
    /** Texto do andamento sem a tag e sem as linhas de valor. */
    cleanedText: string;
}

/**
 * Separa o andamento em valor + texto legível.
 *
 * `value` alimenta o currentValue do ativo; `cleanedText` é o que o usuário lê
 * na timeline, sem a tag de controle nem os campos de valor que já viram coluna
 * própria. Se a limpeza esvaziar o texto, devolve o original: é preferível
 * mostrar algo ruidoso a mostrar um andamento em branco.
 */
export function parseAndCleanDescription(description: string | null | undefined): ParsedDescription {
    if (!description) return { value: null, cleanedText: '' };

    const { valorAtualizado } = extractAllValues(description);

    const cleanedText = description
        .replace(new RegExp(TAG_RELATORIO, 'gi'), '')
        .replace(/Valor da Causa:\s*R\$\s*[\d.,]+/gi, '')
        .replace(/Valor da Compra:\s*R\$\s*[\d.,]+/gi, '')
        .replace(/Valor Atualizado:\s*R\$\s*[\d.,]+/gi, '')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    return {
        value: valorAtualizado,
        cleanedText: cleanedText || description.trim(),
    };
}
