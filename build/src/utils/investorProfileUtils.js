"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calcularPesoPreferencias = exports.calcularPesoInvestimentosAtuais = exports.calcularPesoExperiencia = exports.calcularPesoToleranciaRisco = exports.calcularPesoObjetivoInvestimento = exports.calcularPesoRendaMensal = exports.calcularPesoIdade = void 0;
function calcularPesoIdade(idade) {
    return __awaiter(this, void 0, void 0, function* () {
        if (idade >= 18 && idade <= 30) {
            return 3; // Arrojado
        }
        else if (idade >= 31 && idade <= 45) {
            return 3; // Moderado/Arrojado
        }
        else if (idade >= 46 && idade <= 60) {
            return 2; // Moderado/Conservador
        }
        else if (idade > 60) {
            return 1; // Conservador
        }
        else {
            return 0; // Idade inválida
        }
    });
}
exports.calcularPesoIdade = calcularPesoIdade;
function calcularPesoRendaMensal(rendaMensal) {
    return __awaiter(this, void 0, void 0, function* () {
        if (rendaMensal <= 5000) {
            return 1; // Conservador
        }
        else if (rendaMensal > 5000 && rendaMensal <= 10000) {
            return 2; // Moderado/Conservador
        }
        else if (rendaMensal > 10000 && rendaMensal <= 20000) {
            return 3; // Moderado/Arrojado
        }
        else if (rendaMensal > 20000) {
            return 4; // Arrojado
        }
        else {
            return 0; // Renda mensal inválida
        }
    });
}
exports.calcularPesoRendaMensal = calcularPesoRendaMensal;
function calcularPesoObjetivoInvestimento(objetivo) {
    return __awaiter(this, void 0, void 0, function* () {
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
                return 1; // Peso padrão para "Outro"
        }
    });
}
exports.calcularPesoObjetivoInvestimento = calcularPesoObjetivoInvestimento;
function calcularPesoExperiencia(investiuAntes, tipoInvestimento, conhecimento) {
    return __awaiter(this, void 0, void 0, function* () {
        let peso = 0;
        if (investiuAntes) {
            peso += 3;
            switch (tipoInvestimento) {
                case 'Residencial':
                    peso += 2;
                    break;
                case 'Comercial':
                case 'Terrenos':
                case 'Outros':
                    peso += 2;
                    break;
            }
        }
        else {
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
    });
}
exports.calcularPesoExperiencia = calcularPesoExperiencia;
function calcularPesoToleranciaRisco(tolerancia) {
    return __awaiter(this, void 0, void 0, function* () {
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
    });
}
exports.calcularPesoToleranciaRisco = calcularPesoToleranciaRisco;
function calcularPesoInvestimentosAtuais(possuiOutros, quaisOutros) {
    return __awaiter(this, void 0, void 0, function* () {
        let peso = 0;
        if (possuiOutros) {
            peso = 2;
            switch (quaisOutros) {
                case 'Ações':
                    peso += 3;
                    break;
                case 'Renda fixa':
                    peso += 1;
                    break;
                case 'Fundos de investimento':
                case 'Outros':
                    peso += 1;
                    break;
            }
        }
        return peso;
    });
}
exports.calcularPesoInvestimentosAtuais = calcularPesoInvestimentosAtuais;
function calcularPesoPreferencias(tipoImovel, tipoRenda) {
    return __awaiter(this, void 0, void 0, function* () {
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
                peso += 2;
                break;
            case 'Apenas revenda':
                peso += 2;
                break;
            case 'Ambos':
                peso += 3;
                break;
        }
        return peso;
    });
}
exports.calcularPesoPreferencias = calcularPesoPreferencias;
