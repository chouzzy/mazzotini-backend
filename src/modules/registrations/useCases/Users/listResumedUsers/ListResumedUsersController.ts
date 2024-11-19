import { Request, Response } from "express";
import { UsersEntity } from "../../../entities/Users";
import { UsersRepository } from "../../../repositories/implementations/UsersRepository";
import { ListResumedUsersUseCase } from "./ListResumedUsersUseCase";
import { checkQuery } from "./ListResumedUsersCheck";
import { Prisma } from "@prisma/client";

interface ListResumedUsersRequestProps {
    id?: UsersEntity["id"],
    name?: UsersEntity["name"],
    email?: UsersEntity["email"],
    role?: UsersEntity["role"],
    page?: string,
    pageRange?: string
}

class ListResumedUsersController {
    async handle(req: Request, res: Response): Promise<Response> {

        try {

            const query = req.query

            await checkQuery(query)

            // Instanciando o useCase no repositório com as funções
            const usersRepository = new UsersRepository()

            const listResumedUsersUseCase = new ListResumedUsersUseCase(usersRepository);

            const users = await listResumedUsersUseCase.execute(query)

            return res.status(200).json({
                successMessage: "Usuários listados resumidamente com sucesso!",
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
                return res.status(401).json({ error: { name: 'ListResumedUsersController error: C2DI API', message: String(error) } })
            }

        }
    }
}

export { ListResumedUsersController, ListResumedUsersRequestProps }