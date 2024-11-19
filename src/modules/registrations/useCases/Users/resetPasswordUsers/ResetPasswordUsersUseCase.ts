import { IUsersRepository } from "../../../repositories/IUsersRepository"
import { UsersEntity } from "../../../entities/Users"
import { Users } from "@prisma/client"
//////


class ResetPasswordUsersUseCase {
    constructor(
        private usersRepository: IUsersRepository) { }

    async execute(email: UsersEntity["email"]): Promise<void> {

        try {

            const user = await this.usersRepository.resetPassword(email)

            return user
        
        } catch (error) {
            throw error
        }
    }

}

export { ResetPasswordUsersUseCase }
