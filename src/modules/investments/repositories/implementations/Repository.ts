// import { Investment, Users, UserProprietario } from "@prisma/client";
// import { prisma } from "../../../../prisma";
// import { validationResponse } from "../../../../types";
// import { filterPrismaInvestmentsByInvestmentID, filterPrismaInvestmentsByUserID } from "../../../../utils/userProprietarioUtils";
// import { UserProprietarioEntity } from "../../entities/UserProprietario";
// import { IUserProprietarioRepository } from "../IUserProprietarioRepository";
// import { ListUserProprietarioFormatted } from "../../useCases/UserProprietario/listUserProprietario/ListUserProprietariosUseCase";
// import { CreateUserProprietarioRequestProps } from "../../useCases/UserProprietario/createUserProprietario/CreateUserProprietarioController";
// import { createPrismaUserProprietario, deletePrismaUserProprietarios, filterPrismaUserProprietario, filterPrismaUserProprietariosByInvestmentID } from "../../../../utils/userProprietarioUtils";



// class UserProprietarioRepository implements IUserProprietarioRepository {

//     private userProprietario: UserProprietarioEntity[]
//     constructor() {
//         this.userProprietario = [];
//     }

//     async filterUserProprietario(listUserProprietarioData: ListUserProprietarioFormatted): Promise<Investment[] | Users[] | UserProprietario[] | undefined> {

//         try {

//             const { userID, investmentID } = listUserProprietarioData

//             if (userID && !investmentID) {

//                 const filteredInvestmentsByUserID = await filterPrismaInvestmentsByUserID(listUserProprietarioData)

//                 return filteredInvestmentsByUserID
//             }

//             if (!userID && investmentID) {

//                 const filteredUsersByInvestmentIDs = await filterPrismaInvestmentsByInvestmentID(listUserProprietarioData)

//                 return filteredUsersByInvestmentIDs
//             }
//             if (!userID && !investmentID) {

//                 const allUserProprietarios = await filterPrismaUserProprietario(listUserProprietarioData)

//                 return allUserProprietarios
//             }


//         } catch (error) {
//             throw error
//         }
//     }


//     async filterUserProprietarioByInvestmentID(listUserProprietarioData: ListUserProprietarioFormatted): Promise<UserProprietario[]> {

//         try {

//             const { userID, investmentID } = listUserProprietarioData

//             if (!investmentID) {
//                 throw Error("ID do investimento inválido")
//             }

//             const filteredUsersByInvestmentIDs = await filterPrismaUserProprietariosByInvestmentID(listUserProprietarioData)

//             return filteredUsersByInvestmentIDs


//         } catch (error) {
//             throw error
//         }
//     }

//     async createUserProprietario(userProprietarioData: CreateUserProprietarioRequestProps): Promise<validationResponse> {

//         const userProprietario = await createPrismaUserProprietario(userProprietarioData)

//         return {
//             isValid: true,
//             statusCode: 202,
//             successMessage: 'Created investment.',
//             userProprietario: userProprietario
//         }
//     }


//     async deleteUserProprietario(id:UserProprietarioEntity["id"]): Promise<UserProprietario> {

//         const userProprietarioDeleted = await deletePrismaUserProprietarios(id)

//         return userProprietarioDeleted
//     }
// }

// export { UserProprietarioRepository }
