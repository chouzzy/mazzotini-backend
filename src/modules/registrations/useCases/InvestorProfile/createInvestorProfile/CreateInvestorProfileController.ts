import { Request, Response } from "express"
import { UsersEntity } from "../../../entities/Users"
import { CreateInvestorProfileUseCase } from "./CreateInvestorProfileUseCase"
import { UsersRepository } from "../../../repositories/implementations/UsersRepository"
import { checkBody } from "./CreateInvestorProfileCheck"
import { Prisma } from "@prisma/client"
import { InvestorProfileRepository } from "../../../repositories/implementations/InvestorProfileRepository"

interface CreateInvestorProfileRequestProps {
    userId: UsersEntity["id"];
    name: string;
    age: number;
    profession: string;
    monthlyIncome: number;
    investmentGoals: string;
    riskTolerance: string;
    investedBefore: boolean;
    investedBeforeType: string;
    investedBeforeTypeOther?: string; // Opcional
    investmentKnowledge: string;
    investmentHorizon: string;
    hasOtherInvestments: boolean;
    otherInvestments?: string; // Opcional
    preferredInvestmentTypes: string;
    preferredRentType: string;
    finalConsiderations?: string; // Opcional
}

class CreateInvestorProfileController {
    async handle(req: Request, res: Response): Promise<Response> {

        try {
            const investorData: CreateInvestorProfileRequestProps = req.body

            investorData.age = Number(investorData.age)
            investorData.monthlyIncome = Number(investorData.monthlyIncome)

            await checkBody(investorData)

            /// instanciação da classe do caso de uso
            const investorProfileRepository = new InvestorProfileRepository()
            const createUsersUseCase = new CreateInvestorProfileUseCase(investorProfileRepository)
            const user = await createUsersUseCase.execute(investorData)

            return res.status(200).json({
                successMessage: "Perfil de investidor criado com sucesso!",
                user: user
            })

        } catch (error) {

            console.log(error)
            if (error instanceof Prisma.PrismaClientValidationError) {
                
                return res.status(401).json({
                    error: {
                        name: error.name,
                        message: error.message,
                    }
                })

            } else {
                return res.status(401).json({ error: { name: 'CreateInvestorProfileController error: C2DI API', message: String(error) } })
            }

        }

    }
}

export { CreateInvestorProfileController, CreateInvestorProfileRequestProps }