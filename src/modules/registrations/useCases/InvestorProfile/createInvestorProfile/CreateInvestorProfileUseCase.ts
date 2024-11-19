import { InvestorProfile } from "@prisma/client";
import { IInvestorProfileRepository } from "../../../repositories/IInvestorProfileRepository";
import { CreateInvestorProfileRequestProps } from "./CreateInvestorProfileController";
import {
    calcularPesoIdade,
    calcularPesoRendaMensal,
    calcularPesoObjetivoInvestimento,
    calcularPesoToleranciaRisco,
    calcularPesoExperiencia,
    calcularPesoInvestimentosAtuais,
    calcularPesoPreferencias
} from "../../../../../utils/investorProfileUtils"


class CreateInvestorProfileUseCase {
    constructor(
        private investorProfileRepository: IInvestorProfileRepository) { }

    async execute(investorProfileData: CreateInvestorProfileRequestProps): Promise<InvestorProfile> {

        try {

            const {
                name,
                age,
                profession,
                monthlyIncome,
                investmentGoals,
                riskTolerance,
                investedBefore,
                investedBeforeType,
                investedBeforeTypeOther,
                investmentKnowledge,
                investmentHorizon,
                hasOtherInvestments,
                otherInvestments,
                preferredInvestmentTypes,
                preferredRentType,
                finalConsiderations,
            } = investorProfileData

            const pesoIdade = await calcularPesoIdade(age)
            const pesoSalario = await calcularPesoRendaMensal(monthlyIncome)
            const pesoObjetivo = await calcularPesoObjetivoInvestimento(investmentGoals)
            const pesoToleranciaARisco = await calcularPesoToleranciaRisco(riskTolerance)
            const pesoExperienciaObjetivo = await calcularPesoExperiencia(investedBefore, investedBeforeType, investmentKnowledge)
            const pesoInvestimentosAtuais = await calcularPesoInvestimentosAtuais(hasOtherInvestments, investmentHorizon)
            const pesoPreferencias = await calcularPesoPreferencias(preferredInvestmentTypes, preferredRentType)

            const pesoFinal = pesoIdade + pesoSalario + pesoObjetivo + pesoExperienciaObjetivo + pesoInvestimentosAtuais + pesoPreferencias + pesoToleranciaARisco

            const createdInvestorProfile = await this.investorProfileRepository.createInvestorProfile(investorProfileData, pesoFinal)

            return createdInvestorProfile

        } catch (error) {
            throw error
        }
    }

}

export { CreateInvestorProfileUseCase }