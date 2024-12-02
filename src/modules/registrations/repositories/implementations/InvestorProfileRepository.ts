import { InvestorProfile, Users } from "@prisma/client";
import { InvestorProfileEntity } from "../../../investments/entities/investorProfile";
import { IInvestorProfileRepository } from "../IInvestorProfileRepository";
import { prisma } from "../../../../prisma";
import { CreateInvestorProfileRequestProps } from "../../useCases/InvestorProfile/createInvestorProfile/CreateInvestorProfileController";




class InvestorProfileRepository implements IInvestorProfileRepository {

    private investorProfile: InvestorProfileEntity[]
    constructor() {
        this.investorProfile = [];
    }

    async createInvestorProfile(investorProfile: CreateInvestorProfileRequestProps, pesoFinal: number): Promise<InvestorProfile> {

        try {

            const userExists = await prisma.users.findUnique({
                where: { id: investorProfile.userId }
            })

            const investorProfileExists = await prisma.investorProfile.findUnique({
                where: {
                    userId: investorProfile.userId
                }
            })



            if (!userExists) {
                throw Error("Usuário não encontrado")
            }

            if (!pesoFinal) {
                throw Error('Ocorreu um erro ao definir o perfil.')
            }

            let riskToleranceCalculated: InvestorProfileEntity["riskTolerance"] = 'CONSERVADOR'
            let investorProfileDescriptionCalculated: Users["investorProfileDescription"] = 'CONSERVADOR'

            if (pesoFinal <= 20) {
                riskToleranceCalculated = 'CONSERVADOR'
                investorProfileDescriptionCalculated = 'Você possui um perfil conservador, priorizando a segurança e a preservação do capital. Prefere investimentos com baixo risco e retorno previsível, mesmo que isso signifique um crescimento mais lento do patrimônio.'
            }
            if ((pesoFinal > 20) && (pesoFinal <= 35)) {
                riskToleranceCalculated = 'MODERADO'
                investorProfileDescriptionCalculated = 'Você possui um perfil moderado, buscando um equilíbrio entre risco e retorno. Está disposto a correr alguns riscos para alcançar seus objetivos, mas também se preocupa com a segurança do seu investimento.'
            }
            if ((pesoFinal > 35)) {
                riskToleranceCalculated = 'ARROJADO'
                investorProfileDescriptionCalculated = 'Você possui um perfil arrojado, buscando maximizar seus retornos e disposto a correr maiores riscos para alcançar seus objetivos. Tem um horizonte de investimento mais longo e se sente confortável com a volatilidade do mercado.'
            }

            console.log(pesoFinal)

            let investmentExperienceDeclared: InvestorProfileEntity["investmentExperience"] = 'INICIANTE'

            switch (investorProfile.investmentKnowledge) {
                case 'Iniciante':
                    investmentExperienceDeclared = 'INICIANTE'
                    break
                case 'Intermediário':
                    investmentExperienceDeclared = 'INTERMEDIARIO'
                    break
                case 'Avançado':
                    investmentExperienceDeclared = 'AVANCADO'
                    break
            }


            if (investorProfileExists) {

                const investorProfileUpdated = await prisma.investorProfile.update({
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
                })

                const updatedUser = await prisma.users.update({
                    where: { id: userExists.id },
                    data: {
                        investorProfileName: investorProfileUpdated.riskTolerance,
                        investorProfileDescription: investorProfileDescriptionCalculated
                    }
                })

                console.log('atualizado com sucesso')

                return investorProfileUpdated

            }

            const investorProfileCreated = await prisma.investorProfile.create({
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
            })

            const updatedUser = await prisma.users.update({
                where: { id: userExists.id },
                data: {
                    investorProfileName: investorProfileCreated.riskTolerance,
                    investorProfileDescription: investorProfileDescriptionCalculated
                }
            })

            console.log('criado com sucesso!')
            return investorProfileCreated


        } catch (error) {
            throw error
        }
    }
}

export { InvestorProfileRepository }