import { Investment, UserInvestment, Users } from "@prisma/client"
import { validationResponse } from "../../../types"
import { CreateUserInvestmentRequestProps } from "../useCases/UserInvestment/createUserInvestment/CreateUserInvestmentController"
import { ListUserInvestmentRequestProps } from "../useCases/UserInvestment/listUserInvestments/ListUserInvestmentsController"
import { ListUserInvestmentFormatted } from "../useCases/UserInvestment/listUserInvestments/ListUserInvestmentsUseCase"

interface IUserInvestmentRepository {

    createUserInvestment(userInvestmentData: CreateUserInvestmentRequestProps): Promise<validationResponse>

    filterUserInvestment(listUserInvestmentData: ListUserInvestmentFormatted): Promise<Investment[] | Users[] | UserInvestment[] | undefined>
}

export { IUserInvestmentRepository }