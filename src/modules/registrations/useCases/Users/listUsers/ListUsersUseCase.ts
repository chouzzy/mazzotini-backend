import { IUsersRepository } from "../../../repositories/IUsersRepository"
import { FilterUsersRequestProps } from "./ListUsersController"
import { validationResponse } from "../../../../../types"
import { UsersEntity } from "../../../entities/Users"
import { validatePageParams } from "../../../../../utils/userUtils"
import { Users } from "@prisma/client"
//////

interface FilterUsersProps {
    id?: UsersEntity["id"],
    name?: UsersEntity["name"],
    email?: UsersEntity["email"],
    cpf?: UsersEntity["email"],
    username?: UsersEntity["username"],
    page: number,
    pageRange: number
}

class ListUsersUseCase {
    constructor(
        private usersRepository: IUsersRepository) { }

    async execute(filterUserData: FilterUsersRequestProps): Promise<Users[]> {

        try {

            const {
                id,
                name,
                email,
                cpf,
                username
            } = filterUserData

            const data = {
                id,
                name,
                email,
                cpf,
                username
            }

            const { page, pageRange } = await validatePageParams(filterUserData)

            const listUserFormatted: FilterUsersProps = {
                ...data,
                page,
                pageRange
            }

            const users = await this.usersRepository.filterUsers(listUserFormatted)

            return users
        
        } catch (error) {
            throw error
        }
    }

}

export { ListUsersUseCase, FilterUsersProps }
