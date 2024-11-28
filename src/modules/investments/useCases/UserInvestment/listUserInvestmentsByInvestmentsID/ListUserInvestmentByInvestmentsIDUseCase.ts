import { IUserInvestmentRepository } from "../../../repositories/IUserInvestmentRepository"
import { ListUserInvestmentRequestProps } from "./ListUserInvestmentByInvestmentsIDController"
import { validationResponse } from "../../../../../types"
import { validatePageParams } from "../../../../../utils/userInvestmentUtils"
import { UserInvestmentEntity } from "../../../entities/UserInvestment"
import { Investment, UserInvestment, Users } from "@prisma/client"
//////

interface ListUserInvestmentFormatted {
    investmentID?: UserInvestmentEntity["investmentID"]
    page: number,
    pageRange: number
}

class ListUserInvestmentByInvestmentsIDUseCase {
    constructor(
        private userInvestmentRepository: IUserInvestmentRepository) { }

    async execute(listUserInvestmentData: ListUserInvestmentRequestProps): Promise<UserInvestment[]> {

        try {

            const { investmentID } = listUserInvestmentData

            const { page, pageRange } = await validatePageParams(listUserInvestmentData)


            const listUserInvestmentFormatted: ListUserInvestmentFormatted = {
                investmentID,
                page,
                pageRange
            }

            const response = await this.userInvestmentRepository.filterUserInvestmentByInvestmentID(listUserInvestmentFormatted)

            return response

        } catch (error) {
            throw error
        }
    }
}

export { ListUserInvestmentByInvestmentsIDUseCase, ListUserInvestmentFormatted }
