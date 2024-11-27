import { Request, Response } from "express";
import { UserInvestmentEntity } from "../../../entities/UserInvestment";
import { UserInvestmentRepository } from "../../../repositories/implementations/UserInvestmentRepository";
import { checkQuery } from "./ListUserInvestmentsCheck";
import { ListUserInvestmentUseCase } from "./ListUserInvestmentsUseCase";
import { Prisma } from "@prisma/client";

interface ListUserInvestmentRequestProps {

    userID?: UserInvestmentEntity["userID"],
    investmentID?: UserInvestmentEntity["investmentID"]
    page?: string,
    pageRange?: string
}

class ListUserInvestmentController {
    async handle(req: Request, res: Response): Promise<Response> {

        try {


            const listUserInvestmentData: ListUserInvestmentRequestProps = req.query

            const bodyValidation = await checkQuery(listUserInvestmentData)

            if (bodyValidation.isValid === false) {
                return res.status(401).json({ errorMessage: bodyValidation.errorMessage })
            }

            // Instanciando o useCase no repositório com as funções
            const userInvestmentRepository = new UserInvestmentRepository()

            const listUsersUseCase = new ListUserInvestmentUseCase(userInvestmentRepository);

            const response = await listUsersUseCase.execute(listUserInvestmentData)

            return res.status(200).json({
                successMessage: "Investimentos listados com sucesso!",
                list: response
            })

        } catch (error) {

            if (error instanceof Prisma.PrismaClientValidationError) {

                console.log(error)
                return res.status(401).json({
                    error: {
                        name: error.name,
                        message: error.message,
                    }
                })

            } else {
                console.log(error)
                return res.status(401).json({ error: { name: 'ListUserInvestmentController error: C2DI API', message: String(error) } })
            }
        }

    }
}

export { ListUserInvestmentController, ListUserInvestmentRequestProps }