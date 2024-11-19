import { userCreated, validationResponse } from "../../../../../types";
import { IUsersRepository } from "../../../repositories/IUsersRepository";
import { checkBody } from "./CreateUsersCheck";
import { CreateUsersRequestProps } from "./CreateUsersController";


class CreateUsersUseCase {
    constructor(
        private usersRepository: IUsersRepository) {}

    async execute(usersData: CreateUsersRequestProps): Promise<userCreated> {
        
        try {
            
            const createdUsers = await this.usersRepository.createUsers(usersData)
            
            return createdUsers

        } catch (error) {
            throw error
        }
    }
    
}

export {CreateUsersUseCase}