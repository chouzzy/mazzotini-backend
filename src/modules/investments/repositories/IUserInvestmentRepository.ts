import { Investment, UserInvestment, Users } from "@prisma/client"
import { validationResponse } from "../../../types"
import { CreateUserInvestmentRequestProps } from "../useCases/UserInvestment/createUserInvestment/CreateUserInvestmentController"
import { ListUserInvestmentRequestProps } from "../useCases/UserInvestment/listUserInvestments/ListUserInvestmentsController"
import { ListUserInvestmentFormatted } from "../useCases/UserInvestment/listUserInvestments/ListUserInvestmentsUseCase"
import { UserInvestmentEntity } from "../entities/UserInvestment"

interface IUserInvestmentRepository {

    createUserInvestment(userInvestmentData: CreateUserInvestmentRequestProps): Promise<validationResponse>

    deleteUserInvestment(id:UserInvestmentEntity["id"]): Promise<UserInvestment>

    filterUserInvestment(listUserInvestmentData: ListUserInvestmentFormatted): Promise<Investment[] | Users[] | UserInvestment[] | undefined>

    filterUserInvestmentByInvestmentID(listUserInvestmentData: ListUserInvestmentFormatted): Promise<UserInvestment[]>
}

export { IUserInvestmentRepository }