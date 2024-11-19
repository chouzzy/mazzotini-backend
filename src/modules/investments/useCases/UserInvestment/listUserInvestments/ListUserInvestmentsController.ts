import { Request, Response } from "express";
import { UserInvestmentEntity } from "../../../entities/UserInvestment";
import { UserInvestmentRepository } from "../../../repositories/implementations/UserInvestmentRepository";
import { checkQuery } from "./ListUserInvestmentsCheck";
import { ListUserInvestmentUseCase } from "./ListUserInvestmentsUseCase";

interface ListUserInvestmentRequestProps {

    userID?: UserInvestmentEntity["userID"],
    investmentID?: UserInvestmentEntity["investmentID"]
    page?: string,
    pageRange?: string
}

class ListUserInvestmentController {
    async handle(req: Request, res: Response): Promise<Response> {

        const listUserInvestmentData: ListUserInvestmentRequestProps = req.query


        const bodyValidation = await checkQuery(listUserInvestmentData)

        if (bodyValidation.isValid === false) {
            return res.status(401).json({ errorMessage: bodyValidation.errorMessage })
        }


        // Instanciando o useCase no repositório com as funções
        const userInvestmentRepository = new UserInvestmentRepository()

        const listUsersUseCase = new ListUserInvestmentUseCase(userInvestmentRepository);

        const response = await listUsersUseCase.execute(listUserInvestmentData)

        return res.status(response.statusCode).json(response)

    }
}

export { ListUserInvestmentController, ListUserInvestmentRequestProps }