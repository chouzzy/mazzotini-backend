import { Request, Response } from "express";
import { UsersEntity } from "../../../entities/Users";
import { UsersRepository } from "../../../repositories/implementations/UsersRepository";
import { ResetPasswordUsersUseCase } from "./ResetPasswordUsersUseCase";
import { Prisma } from "@prisma/client";
import { checkBody } from "./ResetPasswordUsersCheck";

interface ResetPasswordUsersRequestProps {
    email?: UsersEntity["email"],
}

class ResetPasswordUsersController {
    async handle(req: Request, res: Response): Promise<Response> {

        try {

            const body = req.body
            const {email} = req.body
            if (!email) {
                throw Error("E-mail ausente na requisição")
            }

            await checkBody(body)

            // Instanciando o useCase no repositório com as funções
            const usersRepository = new UsersRepository()

            const resetPasswordUsersUseCaseUseCase = new ResetPasswordUsersUseCase(usersRepository);

            await resetPasswordUsersUseCaseUseCase.execute(email)

            return res.status(200).json({
                successMessage: "Enviamos um email para redefinir sua senha. Verifique sua caixa de entrada!",
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
                return res.status(401).json({ error: { name: 'ResetPasswordUsersController error: C2DI API', message: String(error) } })
            }

        }
    }
}

export { ResetPasswordUsersController, ResetPasswordUsersRequestProps }