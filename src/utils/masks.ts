// /src/utils/masks.ts

/**
 * Remove todos os caracteres que não são dígitos de uma string.
 * @param value A string a ser limpa.
 * @returns Apenas os números da string.
 */
export const unmask = (value: string) => value ? value.replace(/\D/g, '') : '';

/**
 * Aplica uma máscara de CEP (XX.XXX-XXX).
 * @param value A string contendo os números.
 */
export const maskCEP = (value: string) => {
    return unmask(value)
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1-$2')
        .substring(0, 10); // Limita o comprimento
};

/**
 * Aplica uma máscara de CPF (XXX.XXX.XXX-XX).
 * @param value A string contendo os números.
 */
export const maskCPF = (value: string) => {
    return unmask(value)
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})/, '$1-$2')
        .substring(0, 14);
};

/**
 * Aplica uma máscara de CNPJ (XX.XXX.XXX/XXXX-XX).
 * @param value A string contendo os números.
 */
export const maskCNPJ = (value: string) => {
    return unmask(value)
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d{1,2})/, '$1-$2')
        .substring(0, 18);
};

/**
 * Aplica dinamicamente a máscara de CPF ou CNPJ com base no comprimento.
 * @param value A string a ser formatada.
 */
export const maskCPFOrCNPJ = (value: string) => {
    const unmaskedValue = unmask(value);
    if (unmaskedValue.length <= 11) {
        return maskCPF(unmaskedValue);
    }
    return maskCNPJ(unmaskedValue);
};

/**
 * Aplica uma máscara de telemóvel/celular.
 * @param value A string contendo os números.
 */
export const maskPhone = (value: string) => {
    const unmaskedValue = unmask(value);
    if (unmaskedValue.length > 10) {
        return unmaskedValue
            .replace(/(\d{2})(\d)/, '($1) $2')
            .replace(/(\d{5})(\d)/, '$1-$2')
            .substring(0, 15);
    }
    return unmaskedValue
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{4})(\d)/, '$1-$2')
        .substring(0, 14);
};

// ============================================================================
//  NOVA FUNÇÃO (Para o Legal One)
// ============================================================================
/**
 * Aplica uma máscara de RG (XX.XXX.XXX-X).
 * NOTA: Esta é uma máscara comum (SP), pode precisar de ajuste para outros estados.
 * @param value A string contendo os números.
 */
export const maskRG = (value: string) => {
    return unmask(value)
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1})/, '$1-$2')
        .substring(0, 12); // Limita a 12 caracteres (XX.XXX.XXX-X)
};


// ============================================================================
//  FUNÇÕES DE TRADUÇÃO (Para o Header / Gestão)
// ============================================================================
/**
 * Traduz os nomes das roles internas (ex: 'ADMIN') para Português (ex: 'Administrador').
 * @param role A string da role (vinda do Auth0).
 * @returns A string traduzida.
 */
export const translateRole = (role: string): string => {
    // Usamos toUpperCase() para garantir a correspondência
    switch (role.toUpperCase()) {
        case 'ADMIN':
            return 'Administrador';
        case 'ASSOCIATE':
            return 'Associado';
        case 'INVESTOR':
            return 'Investidor';
        case 'OPERATOR':
            return 'Operador';
        default:
            return role; // Retorna a role original se não for mapeada
    }
};

/**
 * Retorna um esquema de cores (Chakra UI) para cada role.
 * @param role A string da role (ex: "ADMIN").
 * @returns O nome do colorScheme (ex: "red").
 */
export const getRoleColorScheme = (role: string): string => {
    // Usamos toUpperCase() para garantir a correspondência
    switch (role.toUpperCase()) {
        case 'ADMIN':
            return 'red'; // Administrador (Perigoso)
        case 'OPERATOR':
            return 'orange'; // Operador (Aviso)
        case 'ASSOCIATE':
            return 'blue'; // Associado (Equipa)
        case 'INVESTOR':
            return 'cyan'; // Investidor (Cliente)
        default:
            return 'gray'; // Padrão
    }
};