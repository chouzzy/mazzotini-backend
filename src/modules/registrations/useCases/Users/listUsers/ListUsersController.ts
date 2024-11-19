import { Request, Response } from "express";
import { UsersEntity } from "../../../entities/Users";
import { UsersRepository } from "../../../repositories/implementations/UsersRepository";
import { ListUsersUseCase } from "./ListUsersUseCase";
import { checkQuery } from "./ListUsersCheck";
import { Prisma } from "@prisma/client";

interface FilterUsersRequestProps {
    id?: UsersEntity["id"],
    name?: UsersEntity["name"],
    email?: UsersEntity["email"],
    cpf?: UsersEntity["email"],
    username?: UsersEntity["username"],
    page?: string,
    pageRange?: string
}

class ListUsersController {
    async handle(req: Request, res: Response): Promise<Response> {

        try {

            const query = req.query

            const accessToken = req.cookies
            console.log('Token aceito!')
            console.log(accessToken)
            
            await checkQuery(query)
            
            
            // Instanciando o useCase no repositório com as funções
            const usersRepository = new UsersRepository()
            
            const listUsersUseCase = new ListUsersUseCase(usersRepository);
            
            const users = await listUsersUseCase.execute(query)

            return res.status(200).json({
                successMessage: "Usuários listados com sucesso!",
                users: users
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
                return res.status(401).json({ error: { name: 'ListUsersController error: C2DI API', message: String(error) } })
            }

        }
    }
}

export { ListUsersController, FilterUsersRequestProps }