import { InvestmentEntity } from "../../../entities/Investments"
import { Request, Response } from "express"
import { InvestmentRepository } from "../../../repositories/implementations/InvestmentRepository"
import { DeleteInvestmentUseCase } from "./DeleteInvestmentUseCase"
import { checkBody } from "./DeleteInvestmentCheck"
import { Prisma } from "@prisma/client"


class DeleteInvestmentsController {
    async handle(req: Request, res: Response): Promise<Response> {

        try {   

            const {id} = req.params

            if (typeof(id) != 'string') {
                throw Error("O id deve ser uma string")
            }

            await checkBody(id)

            /// instanciação da classe do caso de uso
            const investmentRepository = new InvestmentRepository()
            const deleteInvestmentUseCase = new DeleteInvestmentUseCase(investmentRepository)
            const investment = await deleteInvestmentUseCase.execute(id)

            return res.status(200).json({
                successMessage: "Investimento deletado com sucesso!",
                investment: investment
            })

        } catch (error) {

            if (error instanceof Prisma.PrismaClientValidationError) {
                return res.status(401).json({
                    error: {
                        name: error.name,
                        message: error.message,
                    }
                })

            } else {
                return res.status(401).json({ error: { name: 'DeleteInvestmentsController error: C2DI API', message: String(error) } })
            }
        }

    }
}

export { DeleteInvestmentsController }