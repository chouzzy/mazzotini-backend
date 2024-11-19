import { IUsersRepository } from "../../../repositories/IUsersRepository"
import { UsersEntity } from "../../../entities/Users"
import { Users } from "@prisma/client"
//////


class FindUserByEmailUseCase {
    constructor(
        private usersRepository: IUsersRepository) { }

    async execute(email:UsersEntity["email"]): Promise<Users> {

        try {
           
            const users = await this.usersRepository.findUserByEmail(email)

            return users
        
        } catch (error) {
            throw error
        }
    }

}

export { FindUserByEmailUseCase }
