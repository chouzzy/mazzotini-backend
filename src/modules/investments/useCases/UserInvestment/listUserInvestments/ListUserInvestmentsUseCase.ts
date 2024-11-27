import { IUserInvestmentRepository } from "../../../repositories/IUserInvestmentRepository"
import { ListUserInvestmentRequestProps } from "./ListUserInvestmentsController"
import { validationResponse } from "../../../../../types"
import { validatePageParams } from "../../../../../utils/userInvestmentUtils"
import { UserInvestmentEntity } from "../../../entities/UserInvestment"
import { Investment, UserInvestment, Users } from "@prisma/client"
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

    async execute(listUserInvestmentData: ListUserInvestmentRequestProps): Promise<Investment[] | Users[] | UserInvestment[] | undefined> {

        try {

            const { userID, investmentID } = listUserInvestmentData

            const { page, pageRange } = await validatePageParams(listUserInvestmentData)


            const listUserInvestmentFormatted: ListUserInvestmentFormatted = {
                userID,
                investmentID,
                page,
                pageRange
            }

            const response = await this.userInvestmentRepository.filterUserInvestment(listUserInvestmentFormatted)

            return response

        } catch (error) {
            throw error
        }
    }
}

export { ListUserInvestmentUseCase, ListUserInvestmentFormatted }
