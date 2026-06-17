const CPF_REGEX = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/;

export interface DocumentMeta {
    cleanName: string;
    section: 'JURIDICO' | 'PROCESSUAL' | 'PRIVADO_FINANCEIRO';
    cpf: string | null;
}

/**
 * Extrai metadados de um nome de documento seguindo a convenção:
 *   #DocumentoMAA - [CPF] - [Secao] - [Descricao]
 *
 * CPF e Secao são opcionais e podem aparecer em qualquer ordem entre os separadores " - ".
 * Secao válida: Juridico | Processual | Financeiro (default: JURIDICO)
 * CPF retornado sem formatação (11 dígitos) para comparar com o campo cpfOrCnpj do banco.
 */
export function parseDocumentMeta(rawName: string, tagToRemove: string): DocumentMeta {
    const tagPattern = new RegExp(tagToRemove, 'i');
    const withoutTag = rawName.replace(tagPattern, '').replace(/^\s*-\s*/, '').trim();

    const parts = withoutTag.split(/\s*-\s*/);
    const remainingParts: string[] = [];
    let cpf: string | null = null;
    let section: DocumentMeta['section'] = 'JURIDICO';

    for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;

        const cpfMatch = trimmed.match(CPF_REGEX);
        if (cpfMatch) {
            cpf = trimmed.replace(/[.\-\s]/g, ''); // remove formatação → 11 dígitos
            continue;
        }

        const lower = trimmed.toLowerCase();
        if (lower === 'processual') { section = 'PROCESSUAL'; continue; }
        if (lower === 'financeiro' || lower === 'privado') { section = 'PRIVADO_FINANCEIRO'; continue; }
        if (lower === 'juridico' || lower === 'jurídico') { section = 'JURIDICO'; continue; }

        remainingParts.push(trimmed);
    }

    return {
        cleanName: remainingParts.join(' - ') || 'Documento Sincronizado',
        section,
        cpf,
    };
}
