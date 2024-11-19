import { IUsersRepository } from "../../../repositories/IUsersRepository"
import { UsersEntity } from "../../../entities/Users"
import { Users } from "@prisma/client"
//////


class FindUserByIDUseCase {
    constructor(
        private usersRepository: IUsersRepository) { }

    async execute(id:UsersEntity["id"]): Promise<Users> {

        try {
           
            const user = await this.usersRepository.findUserByID(id)

            return user
        
        } catch (error) {
            throw error
        }
    }

}

export { FindUserByIDUseCase }
