import { validationResponse } from "../../../../../types"
import { IUserInvestmentRepository } from "../../../repositories/IUserInvestmentRepository"
import { CreateUserInvestmentRequestProps } from "./CreateUserInvestmentController"



class CreateUserInvestmentUseCase {
    constructor(
        private UserInvestmentRepository: IUserInvestmentRepository) {}

    async execute(userInvestmentData: CreateUserInvestmentRequestProps): Promise<validationResponse> {
        
        const createdUsers = await this.UserInvestmentRepository.createUserInvestment(userInvestmentData)
        
        return createdUsers
    }
    
}

export {CreateUserInvestmentUseCase}