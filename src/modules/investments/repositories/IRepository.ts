// import { Investment, UserProprietario, Users } from "@prisma/client"
// import { validationResponse } from "../../../types"
// import { UserProprietarioEntity } from "../entities/UserProprietario"
// import { CreateUserProprietarioRequestProps } from "../useCases/UserProprietario/createUserProprietario/CreateUserProprietarioController"
// import { ListUserProprietarioFormatted } from "../useCases/UserProprietario/listUserProprietario/ListUserProprietariosUseCase"

// interface IUserProprietarioRepository {

//     createUserProprietario(userInvestmentData: CreateUserProprietarioRequestProps): Promise<validationResponse>

//     deleteUserProprietario(id:UserProprietarioEntity["id"]): Promise<UserProprietario>

//     filterUserProprietario(listUserProprietarioData: ListUserProprietarioFormatted): Promise<Investment[] | Users[] | UserProprietario[] | undefined>

//     filterUserProprietarioByInvestmentID(listUserProprietarioData: ListUserProprietarioFormatted): Promise<UserProprietario[]>
// }

// export { IUserProprietarioRepository }