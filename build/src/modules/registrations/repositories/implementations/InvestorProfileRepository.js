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
exports.InvestorProfileRepository = void 0;
const prisma_1 = require("../../../../prisma");
class InvestorProfileRepository {
    constructor() {
        this.investorProfile = [];
    }
    createInvestorProfile(investorProfile, pesoFinal) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const userExists = yield prisma_1.prisma.users.findUnique({
                    where: { id: investorProfile.userId }
                });
                const investorProfileExists = yield prisma_1.prisma.investorProfile.findUnique({
                    where: {
                        userId: investorProfile.userId
                    }
                });
                if (!userExists) {
                    throw Error("Usuário não encontrado");
                }
                if (!pesoFinal) {
                    throw Error('Ocorreu um erro ao definir o perfil.');
                }
                let riskToleranceCalculated = 'CONSERVADOR';
                let investorProfileDescriptionCalculated = 'CONSERVADOR';
                if (pesoFinal <= 10) {
                    riskToleranceCalculated = 'CONSERVADOR';
                    investorProfileDescriptionCalculated = 'Você possui um perfil conservador, priorizando a segurança e a preservação do capital. Prefere investimentos com baixo risco e retorno previsível, mesmo que isso signifique um crescimento mais lento do patrimônio.';
                }
                if ((pesoFinal > 10) && (pesoFinal <= 15)) {
                    riskToleranceCalculated = 'MODERADO';
                    investorProfileDescriptionCalculated = 'Você possui um perfil moderado, buscando um equilíbrio entre risco e retorno. Está disposto a correr alguns riscos para alcançar seus objetivos, mas também se preocupa com a segurança do seu investimento.';
                }
                if ((pesoFinal > 15)) {
                    riskToleranceCalculated = 'ARROJADO';
                    investorProfileDescriptionCalculated = 'Você possui um perfil arrojado, buscando maximizar seus retornos e disposto a correr maiores riscos para alcançar seus objetivos. Tem um horizonte de investimento mais longo e se sente confortável com a volatilidade do mercado.';
                }
                console.log(pesoFinal);
                let investmentExperienceDeclared = 'INICIANTE';
                switch (investorProfile.investmentKnowledge) {
                    case 'Iniciante':
                        investmentExperienceDeclared = 'INICIANTE';
                        break;
                    case 'Intermediário':
                        investmentExperienceDeclared = 'INTERMEDIARIO';
                        break;
                    case 'Avançado':
                        investmentExperienceDeclared = 'AVANCADO';
                        break;
                }
                if (investorProfileExists) {
                    const investorProfileUpdated = yield prisma_1.prisma.investorProfile.update({
                        where: { userId: investorProfile.userId },
                        data: {
                            riskTolerance: riskToleranceCalculated,
                            investmentGoals: [investorProfile.investmentGoals],
                            investmentHorizon: investorProfile.investmentHorizon,
                            monthlyIncome: investorProfile.monthlyIncome,
                            netWorth: investorProfile.monthlyIncome,
                            investmentExperience: investmentExperienceDeclared,
                            preferredInvestmentTypes: [investorProfile.preferredInvestmentTypes],
                            otherInvestments: investorProfile.otherInvestments,
                        }
                    });
                    const updatedUser = yield prisma_1.prisma.users.update({
                        where: { id: userExists.id },
                        data: {
                            investorProfileName: investorProfileUpdated.riskTolerance,
                            investorProfileDescription: investorProfileDescriptionCalculated
                        }
                    });
                    console.log('atualizado com sucesso');
                    return investorProfileUpdated;
                }
                const investorProfileCreated = yield prisma_1.prisma.investorProfile.create({
                    data: {
                        riskTolerance: riskToleranceCalculated,
                        investmentGoals: [investorProfile.investmentGoals],
                        investmentHorizon: investorProfile.investmentHorizon,
                        monthlyIncome: investorProfile.monthlyIncome,
                        netWorth: investorProfile.monthlyIncome,
                        investmentExperience: investmentExperienceDeclared,
                        preferredInvestmentTypes: [investorProfile.preferredInvestmentTypes],
                        otherInvestments: investorProfile.otherInvestments,
                        user: { connect: { id: investorProfile.userId } }
                    }
                });
                const updatedUser = yield prisma_1.prisma.users.update({
                    where: { id: userExists.id },
                    data: {
                        investorProfileName: investorProfileCreated.riskTolerance,
                        investorProfileDescription: investorProfileDescriptionCalculated
                    }
                });
                console.log('criado com sucesso!');
                return investorProfileCreated;
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.InvestorProfileRepository = InvestorProfileRepository;
