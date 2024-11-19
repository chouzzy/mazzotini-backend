import { IUserInvestmentRepository } from "../../../repositories/IUserInvestmentRepository"
import { ListUserInvestmentRequestProps } from "./ListUserInvestmentsController"
import { validationResponse } from "../../../../../types"
import { validatePageParams } from "../../../../../utils/userInvestmentUtils"
import { UserInvestmentEntity } from "../../../entities/UserInvestment"
//////

interface ListUserInvestmentFormatted {
    userID?: UserInvestmentEntity["userID"],
    investmentID?: UserInvestmentEntity["investmentID"]
    page: number,
    pageRange: number
}

class ListUserInvestmentUseCase {
    constructor(
        private userInvestmentRepository: IUserInvestmentRepository) { }

    async execute(listUserInvestmentData: ListUserInvestmentRequestProps): Promise<validationResponse> {

        try {

            const { userID, investmentID } = listUserInvestmentData

            const { page, pageRange } = await validatePageParams(listUserInvestmentData)


            const listUserInvestmentFormatted: ListUserInvestmentFormatted = {
                userID,
                investmentID,
                page,
                pageRange
            }

            const users = await this.userInvestmentRepository.filterUserInvestment(listUserInvestmentFormatted)

            return users

        } catch (error) {
            return {
                isValid: false,
                statusCode: 402,
                errorMessage: String(error)
            }
        }
    }
}

export { ListUserInvestmentUseCase, ListUserInvestmentFormatted }
