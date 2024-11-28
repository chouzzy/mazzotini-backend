

async function calcularPesoIdade(idade: number): Promise<number> {
    if (idade >= 18 && idade <= 30) {
        return 4; // Arrojado
    } else if (idade >= 31 && idade <= 45) {
        return 3; // Moderado/Arrojado
    } else if (idade >= 46 && idade <= 60) {
        return 2; // Moderado/Conservador
    } else if (idade > 60) {
        return 1; // Conservador
    } else {
        return 0; // Idade inválida
    }
}


async function calcularPesoRendaMensal(rendaMensal: number): Promise<number> {
    if (rendaMensal <= 5000) {
        return 1; // Conservador
    } else if (rendaMensal > 5000 && rendaMensal <= 10000) {
        return 2; // Moderado/Conservador
    } else if (rendaMensal > 10000 && rendaMensal <= 20000) {
        return 3; // Moderado/Arrojado
    } else if (rendaMensal > 20000) {
        return 4; // Arrojado
    } else {
        return 0; // Renda mensal inválida
    }
}

async function calcularPesoObjetivoInvestimento(objetivo: string): Promise<number> {
    switch (objetivo) {
        case 'Aumento de patrimônio':
            return 4;
        case 'Renda passiva (aluguéis)':
            return 2;
        case 'Valorização a longo prazo':
            return 3;
        case 'Diversificação de investimentos':
            return 1;
        default:
            return 2; // Peso padrão para "Outro"
    }
}

async function calcularPesoExperiencia(investiuAntes: boolean, tipoInvestimento: string, conhecimento: string): Promise<number> {
    let peso = 0;

    if (investiuAntes) {
        peso += 3;
        switch (tipoInvestimento) {
            case 'Residencial':
                peso += 1;
                break;
            case 'Comercial':
            case 'Terrenos':
            case 'Outros':
                peso += 2;
                break;
        }
    } else {
        peso += 1;
    }

    switch (conhecimento) {
        case 'Iniciante':
            peso += 1;
            break;
        case 'Intermediário':
            peso += 2;
            break;
        case 'Avançado':
            peso += 3;
            break;
    }

    return peso;
}

async function calcularPesoToleranciaRisco(tolerancia: string): Promise<number> {
    switch (tolerancia) {
        case 'Baixa (prefiro investimentos seguros)':
            return 1;
        case 'Média (aceito alguma volatilidade)':
            return 2;
        case 'Alta (estou disposto a correr riscos por maiores retornos)':
            return 3;
        default:
            return 0; // Valor inválido
    }
}

async function calcularPesoInvestimentosAtuais(possuiOutros: boolean, quaisOutros: string): Promise<number> {
    let peso = 0;

    if (possuiOutros) {
        peso = 2
        switch (quaisOutros) {
            case 'Ações':
                peso += 3;
                break;
            case 'Renda fixa':
                peso += 1;
                break;
            case 'Fundos de investimento':
            case 'Outros':
                peso += 2;
                break;
        }
    }

    return peso;
}

async function calcularPesoPreferencias(tipoImovel: string, tipoRenda: string): Promise<number> {
    let peso = 0;

    switch (tipoImovel) {
        case 'Prontos':
            peso += 1;
            break;
        case 'Em construção':
            peso += 3;
            break;
        case 'Ambos':
            peso += 2;
            break;
    }

    switch (tipoRenda) {
        case 'Apenas aluguel':
            peso += 1;
            break;
        case 'Apenas revenda':
            peso += 3;
            break;
        case 'Ambos':
            peso += 2;
            break;
    }

    return peso;
}

export {
    calcularPesoIdade,
    calcularPesoRendaMensal,
    calcularPesoObjetivoInvestimento,
    calcularPesoToleranciaRisco,
    calcularPesoExperiencia,
    calcularPesoInvestimentosAtuais,
    calcularPesoPreferencias
}