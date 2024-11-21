import { InvestmentEntity } from "../../../entities/Investments"
import { Request, Response } from "express"
import { InvestmentRepository } from "../../../repositories/implementations/InvestmentRepository"
import { Prisma } from "@prisma/client"
import { checkParam } from "./DeleteInvestmentPartnerCheck"
import { DeleteInvestmentPartnerUseCase } from "./DeleteInvestmentPartnerUseCase"


class DeleteInvestmentPartnerController {
    async handle(req: Request, res: Response): Promise<Response> {

        try {

            const { investmentID, partnerID } = req.body.data
            if (typeof (partnerID) != 'string' || typeof (investmentID) != 'string') {
                throw Error("O id deve ser uma string")
            }

            await checkParam(partnerID)
            await checkParam(investmentID)

            /// instanciação da classe do caso de uso
            const investmentRepository = new InvestmentRepository()
            const deleteInvestmentUseCase = new DeleteInvestmentPartnerUseCase(investmentRepository)
            const investment = await deleteInvestmentUseCase.execute(investmentID, partnerID)

            return res.status(200).json({
                successMessage: "Partner deletado com sucesso!",
                partners: investment
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
                return res.status(401).json({ error: { name: 'DeleteInvestmentPartnerController error: C2DI API', message: String(error) } })
            }
        }

    }
}

export { DeleteInvestmentPartnerController }