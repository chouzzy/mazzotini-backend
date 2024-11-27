import { Request, Response } from "express"
import { UserInvestmentRepository } from "../../../repositories/implementations/UserInvestmentRepository"
import { UserInvestmentEntity } from "../../../entities/UserInvestment"
import { checkBody } from "./CreateUserInvestmentCheck"
import { CreateUserInvestmentUseCase } from "./CreateUserInvestmentUseCase"


interface CreateUserInvestmentRequestProps {
    userID: UserInvestmentEntity["userID"],
    investmentID: UserInvestmentEntity["investmentID"]
    investedValue: UserInvestmentEntity["investedValue"]
}

class CreateUserInvestmentController {
    async handle(req: Request, res: Response): Promise<Response> {


        const userInvestmentData: CreateUserInvestmentRequestProps = req.body

        const bodyValidation = await checkBody(userInvestmentData)

        if (bodyValidation.isValid === false) {
            return res.status(401).json({ errorMessage: bodyValidation.errorMessage })
        }

        /// instanciação da classe do caso de uso
        const userRepository = new UserInvestmentRepository()
        const createUsersUseCase = new CreateUserInvestmentUseCase(userRepository)
        const response = await createUsersUseCase.execute(userInvestmentData)

        return res.status(response.statusCode).json(response)

    }
}

export { CreateUserInvestmentController, CreateUserInvestmentRequestProps }