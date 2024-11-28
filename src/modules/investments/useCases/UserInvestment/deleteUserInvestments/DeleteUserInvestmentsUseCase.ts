import { UserInvestment } from "@prisma/client";
import { validationResponse } from "../../../../../types";
import { UserInvestmentEntity } from "../../../entities/UserInvestment";
import { IUserInvestmentRepository } from "../../../repositories/IUserInvestmentRepository";


class DeleteUsersUseCase {
    constructor(
        private userInvestmentRepository: IUserInvestmentRepository) {}

    async execute(id:UserInvestmentEntity["id"]): Promise<UserInvestment> {
        
        try {
            
            const deletedUsers = await this.userInvestmentRepository.deleteUserInvestment(id)
            
            return deletedUsers

        } catch (error) {
            throw error
        }
    }
    
}

export {DeleteUsersUseCase}