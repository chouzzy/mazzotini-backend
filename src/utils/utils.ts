const extractAllValues = (text: string | null | undefined) => {
    if (!text) return { valorDaCausa: null, valorDaCompra: null, valorAtualizado: null };

    const parse = (match: RegExpMatchArray | null, truncate = false) => {
        if (match && match[1]) {
            const numericString = match[1].replace(/\./g, '').replace(',', '.');
            const value = parseFloat(numericString);
            return truncate ? Math.trunc(value) : value;
        }
        return null;
    };

    const valorDaCausa = text.match(/Valor da Causa:\s*R\$\s*([\d.,]+)/i);
    const valorDaCompra = text.match(/Valor da Compra:\s*R\$\s*([\d.,]+)/i);
    const valorAtualizado = text.match(/Valor Atualizado:\s*R\$\s*([\d.,]+)/i);

    console.log('Extraído:', { valorDaCausa, valorDaCompra, valorAtualizado });

    return {
        valorDaCausa: parse(valorDaCausa),
        valorDaCompra: parse(valorDaCompra, true), 
        valorAtualizado: parse(valorAtualizado),
    };
};

/**
 * Extrai apenas o texto descritivo do andamento, ignorando a tag #SM e os campos de valor.
 */
const extractFreeText = (description: string | null | undefined): string => {
    if (!description || !description.includes('#SM')) {
        return description || "Atualização de Valor";
    }
    const lastValueIndex = description.lastIndexOf('R$');
    if (lastValueIndex === -1) return description.substring(description.indexOf('#SM') + 3).trim();
    const textStartIndex = description.indexOf('\n', lastValueIndex);
    if (textStartIndex === -1) return "Atualização de valores do processo";
    return description.substring(textStartIndex).trim();
};


export { extractAllValues, extractFreeText };