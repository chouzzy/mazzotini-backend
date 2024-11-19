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
exports.CreateInvestorProfileUseCase = void 0;
const investorProfileUtils_1 = require("../../../../../utils/investorProfileUtils");
class CreateInvestorProfileUseCase {
    constructor(investorProfileRepository) {
        this.investorProfileRepository = investorProfileRepository;
    }
    execute(investorProfileData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { name, age, profession, monthlyIncome, investmentGoals, riskTolerance, investedBefore, investedBeforeType, investedBeforeTypeOther, investmentKnowledge, investmentHorizon, hasOtherInvestments, otherInvestments, preferredInvestmentTypes, preferredRentType, finalConsiderations, } = investorProfileData;
                const pesoIdade = yield (0, investorProfileUtils_1.calcularPesoIdade)(age);
                const pesoSalario = yield (0, investorProfileUtils_1.calcularPesoRendaMensal)(monthlyIncome);
                const pesoObjetivo = yield (0, investorProfileUtils_1.calcularPesoObjetivoInvestimento)(investmentGoals);
                const pesoToleranciaARisco = yield (0, investorProfileUtils_1.calcularPesoToleranciaRisco)(riskTolerance);
                const pesoExperienciaObjetivo = yield (0, investorProfileUtils_1.calcularPesoExperiencia)(investedBefore, investedBeforeType, investmentKnowledge);
                const pesoInvestimentosAtuais = yield (0, investorProfileUtils_1.calcularPesoInvestimentosAtuais)(hasOtherInvestments, investmentHorizon);
                const pesoPreferencias = yield (0, investorProfileUtils_1.calcularPesoPreferencias)(preferredInvestmentTypes, preferredRentType);
                const pesoFinal = pesoIdade + pesoSalario + pesoObjetivo + pesoExperienciaObjetivo + pesoInvestimentosAtuais + pesoPreferencias + pesoToleranciaARisco;
                const createdInvestorProfile = yield this.investorProfileRepository.createInvestorProfile(investorProfileData, pesoFinal);
                return createdInvestorProfile;
            }
            catch (error) {
                throw error;
            }
        });
    }
}
exports.CreateInvestorProfileUseCase = CreateInvestorProfileUseCase;
