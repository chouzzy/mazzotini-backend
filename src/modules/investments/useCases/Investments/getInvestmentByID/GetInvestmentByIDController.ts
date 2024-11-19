import { Request, Response } from "express";
import { InvestmentRepository } from "../../../repositories/implementations/InvestmentRepository";
import { GetInvestmentByIDUseCase } from "./GetInvestmentByIDUseCase";
import { Prisma } from "@prisma/client";
import { checkQuery } from "./GetInvestmentByIDCheck";


class GetInvestmentByIDController {
    async handle(req: Request, res: Response): Promise<Response> {

        try {

            const {id} = req.params

            if (typeof (id) != 'string') {
                throw Error("O id deve ser uma string")
            }

            await checkQuery(id)

            // Instanciando o useCase no repositório com as funções
            const investmentRepository = new InvestmentRepository()

            const getInvestmentByIDUseCase = new GetInvestmentByIDUseCase(investmentRepository);

            const investment = await getInvestmentByIDUseCase.execute(id)

            return res.status(200).json({
                successMessage: "Investimento encontrado com sucesso!",
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
                return res.status(401).json({ error: { name: 'GetInvestmentByIDController error: C2DI API', message: String(error) } })
            }
        }
    }
}

export { GetInvestmentByIDController }