import { validationResponse } from "../../../../../types";
import { UsersEntity } from "../../../entities/Users";
import { IUsersRepository } from "../../../repositories/IUsersRepository";

class DeleteUsersUseCase {
    constructor(
        private usersRepository: IUsersRepository) {}

    async execute(id:UsersEntity["id"], auth0UserID:string): Promise<string> {
        
        try {
            
            const deletedUsers = await this.usersRepository.deleteUsers(id, auth0UserID)
            
            return deletedUsers

        } catch (error) {
            throw error
        }
    }
    
}

export {DeleteUsersUseCase}