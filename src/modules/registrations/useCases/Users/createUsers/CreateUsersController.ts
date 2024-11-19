import { Request, Response } from "express"
import { UsersEntity } from "../../../entities/Users"
import { CreateUsersUseCase } from "./CreateUsersUseCase"
import { UsersRepository } from "../../../repositories/implementations/UsersRepository"
import { checkBody } from "./CreateUsersCheck"
import { Prisma } from "@prisma/client"

interface CreateUsersRequestProps {

    name: UsersEntity["name"]
    email: UsersEntity["email"]
    phoneNumber: UsersEntity["phoneNumber"]
    gender: UsersEntity["gender"]
    profession: UsersEntity["profession"]
    birth: UsersEntity["birth"]
    cpf: UsersEntity["cpf"]
    username: UsersEntity["username"]
    address: UsersEntity["address"]
    investorProfileName: UsersEntity["investorProfileName"]
    investorProfileDescription: UsersEntity["investorProfileDescription"]
    role: UsersEntity["role"]
}

class CreateUsersController {
    async handle(req: Request, res: Response): Promise<Response> {

        try {
            const usersData: CreateUsersRequestProps = req.body

            await checkBody(usersData)

            /// instanciação da classe do caso de uso
            const userRepository = new UsersRepository()
            const createUsersUseCase = new CreateUsersUseCase(userRepository)
            const user = await createUsersUseCase.execute(usersData)

            return res.status(200).json({
                successMessage: "Usuário criado com sucesso!",
                user: user
            })

        } catch (error) {


            if (error instanceof Prisma.PrismaClientValidationError) {
                return res.status(401).json({
                    error: {
                        name: error.name,
                        message: error.message,
                    }
                })

            } else {
                return res.status(401).json({ error: {name: 'CreateUsersController error: C2DI API', message: String(error)} })
            }

        }

    }
}

export { CreateUsersController, CreateUsersRequestProps }