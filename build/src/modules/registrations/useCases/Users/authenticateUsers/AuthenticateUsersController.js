"use strict";
// import { Request, Response } from "express"
// import { UsersEntity } from "../../../entities/Users"
// import { AuthenticateUsersUseCase } from "./AuthenticateUsersUseCase"
// import { UsersRepository } from "../../../repositories/implementations/UsersRepository"
// interface AuthenticateUsersRequestProps {
//     username: UsersEntity["username"],
//     password: UsersEntity["password"],
// }
// class AuthenticateUsersController {
//     async handle(req: Request, res: Response): Promise<Response> {
//         const usersData: AuthenticateUsersRequestProps = req.body
//         /// instanciação da classe do caso de uso
//         const usersRepository = new UsersRepository()
//         const authenticateUsersUseCase = new AuthenticateUsersUseCase(usersRepository)
//         const response = await authenticateUsersUseCase.execute(usersData)
//         return res.status(response.statusCode).json(response)
//     }
// }
// export { AuthenticateUsersController, AuthenticateUsersRequestProps }
