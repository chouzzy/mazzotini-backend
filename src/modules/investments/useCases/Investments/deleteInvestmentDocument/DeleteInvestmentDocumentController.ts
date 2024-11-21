import { InvestmentEntity } from "../../../entities/Investments"
import { Request, Response } from "express"
import { InvestmentRepository } from "../../../repositories/implementations/InvestmentRepository"
import { Prisma } from "@prisma/client"
import { checkParam } from "./DeleteInvestmentDocumentCheck"
import { DeleteInvestmentDocumentUseCase } from "./DeleteInvestmentDocumentUseCase"


class DeleteInvestmentDocumentController {
    async handle(req: Request, res: Response): Promise<Response> {

        try {

            const { investmentID, documentID } = req.body.data
            if (typeof (documentID) != 'string' || typeof (investmentID) != 'string') {
                throw Error("O id deve ser uma string")
            }

            await checkParam(documentID)
            await checkParam(investmentID)

            /// instanciação da classe do caso de uso
            const investmentRepository = new InvestmentRepository()
            const deleteInvestmentUseCase = new DeleteInvestmentDocumentUseCase(investmentRepository)
            const documents = await deleteInvestmentUseCase.execute(investmentID, documentID)

            return res.status(200).json({
                successMessage: "Documento deletado com sucesso!",
                documents: documents
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
                return res.status(401).json({ error: { name: 'DeleteInvestmentDocumentController error: C2DI API', message: String(error) } })
            }
        }

    }
}

export { DeleteInvestmentDocumentController }