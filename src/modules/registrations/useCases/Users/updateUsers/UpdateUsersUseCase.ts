import { Users } from "@prisma/client";
import { validationResponse } from "../../../../../types";
import { UsersEntity } from "../../../entities/Users";
import { IUsersRepository } from "../../../repositories/IUsersRepository";
import { checkBody } from "./UpdateUsersCheck";
import { UpdateUsersRequestProps } from "./UpdateUsersController";


class UpdateUsersUseCase {
    constructor(
        private usersRepository: IUsersRepository) {}

    async execute(usersData: UpdateUsersRequestProps, id:UsersEntity["id"]): Promise<Users> {
        
        try {
            
            const updatedUsers = await this.usersRepository.updateUsers(usersData, id)
            
            return updatedUsers

        } catch (error) {
            throw error
        }
    }
    
}

export {UpdateUsersUseCase}