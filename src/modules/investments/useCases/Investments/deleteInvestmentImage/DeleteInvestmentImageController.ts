import { InvestmentEntity } from "../../../entities/Investments"
import { Request, Response } from "express"
import { InvestmentRepository } from "../../../repositories/implementations/InvestmentRepository"
import { Prisma } from "@prisma/client"
import { checkParam } from "./DeleteInvestmentImageCheck"
import { DeleteInvestmentImageUseCase } from "./DeleteInvestmentImageUseCase"


class DeleteInvestmentImageController {
    async handle(req: Request, res: Response): Promise<Response> {

        try {

            const { investmentID, imageID } = req.body.data
            console.log('investmentID, imageID')
            console.log(investmentID, imageID)
            if (typeof (imageID) != 'string' || typeof (investmentID) != 'string') {
                throw Error("O id deve ser uma string")
            }

            await checkParam(imageID)
            await checkParam(investmentID)

            /// instanciação da classe do caso de uso
            const investmentRepository = new InvestmentRepository()
            const deleteInvestmentUseCase = new DeleteInvestmentImageUseCase(investmentRepository)
            const investment = await deleteInvestmentUseCase.execute(investmentID, imageID)

            return res.status(200).json({
                successMessage: "Foto deletada com sucesso!",
                images: investment
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
                return res.status(401).json({ error: { name: 'DeleteInvestmentImageController error: C2DI API', message: String(error) } })
            }
        }

    }
}

export { DeleteInvestmentImageController }