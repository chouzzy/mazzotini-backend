import { IUsersRepository } from "../../../repositories/IUsersRepository"
import { ListResumedUsersRequestProps } from "./ListResumedUsersController"
import { usersResumed, validationResponse } from "../../../../../types"
import { UsersEntity } from "../../../entities/Users"
import { validatePageParams } from "../../../../../utils/userUtils"
//////

interface ListResumedUsersProps {
    id?: UsersEntity["id"],
    name?: UsersEntity["name"],
    email?: UsersEntity["email"],
    role?: UsersEntity["role"],
    page: number,
    pageRange: number
}

class ListResumedUsersUseCase {
    constructor(
        private usersRepository: IUsersRepository) { }

    async execute(listResumedUsersData: ListResumedUsersRequestProps): Promise<usersResumed[]> {

        try {

            const {
                id,
                name,
                email,
                role
            } = listResumedUsersData

            const data = {
                id,
                name,
                email,
                role
            }

            const { page, pageRange } = await validatePageParams(listResumedUsersData)

            const listUserFormatted: ListResumedUsersProps = {
                ...data,
                page,
                pageRange
            }

            const users = await this.usersRepository.listResumedUsers(listUserFormatted)

            return users
        
        } catch (error) {
            throw error
        }
    }

}

export { ListResumedUsersUseCase, ListResumedUsersProps }
