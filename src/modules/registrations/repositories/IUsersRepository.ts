import { Users } from "@prisma/client"
import { userCreated, usersResumed } from "../../../types"
import { UsersEntity } from "../entities/Users"
import { CreateUsersRequestProps } from "../useCases/Users/createUsers/CreateUsersController"
import { FilterUsersProps } from "../useCases/Users/listUsers/ListUsersUseCase"
import { UpdateUsersRequestProps } from "../useCases/Users/updateUsers/UpdateUsersController"

interface CheckedFilterUsersRequestProps {
    id: UsersEntity["id"],
    name: UsersEntity["name"],
    email: UsersEntity["email"],
    cpf: UsersEntity["email"],
    username: UsersEntity["username"],
    pageNumber: number,
    pageRangeNumber: number
}

interface IUsersRepository {

    findUserByEmail(email: UsersEntity["email"]): Promise<Users|null>

    findUserByID(id: UsersEntity["id"]): Promise<Users>

    filterUsers(listUserFormatted: FilterUsersProps): Promise<Users[]>

    listResumedUsers(listUserFormatted: FilterUsersProps): Promise<usersResumed[]>

    createUsers(usersData: CreateUsersRequestProps): Promise<userCreated>

    updateUsers(usersData: UpdateUsersRequestProps, id: UsersEntity["id"]): Promise<Users>

    resetPassword(email: UsersEntity["email"]): Promise<void>

    deleteUsers(id: UsersEntity["id"], auth0UserID:string): Promise<string>

    // authenticateUsers({ username, password }: AuthenticateUsersRequestProps): Promise<validationResponse>

}

export { IUsersRepository, CheckedFilterUsersRequestProps }