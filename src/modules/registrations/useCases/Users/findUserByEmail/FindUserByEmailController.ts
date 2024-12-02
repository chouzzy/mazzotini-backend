import { Request, Response } from "express";
import { UsersEntity } from "../../../entities/Users";
import { UsersRepository } from "../../../repositories/implementations/UsersRepository";
import { FindUserByEmailUseCase } from "./FindUserByEmailUseCase";
import { checkQuery } from "./FindUserByEmailCheck";
import { Prisma } from "@prisma/client";


class FindUserByEmailController {
    async handle(req: Request, res: Response): Promise<Response> {

        try {

            const query = req.query

            console.log('Token aceito!')
            const { email } = query

            await checkQuery(query)



            if (typeof (email) != 'string') {
                throw Error("Formato do e-mail inválido")
            }

            // Instanciando o useCase no repositório com as funções
            const usersRepository = new UsersRepository()

            const findUserByEmailUseCase = new FindUserByEmailUseCase(usersRepository);

            const user = await findUserByEmailUseCase.execute(email)

            return res.status(200).json({
                successMessage: "Usuário encontrado com sucesso!",
                user: user
            })


        } catch (error) {

            console.log(error)


            if (error instanceof Error) {

                if (error.message == "Usuário não encontrado.") {
                    return res.status(404).json({
                        error: {
                            name: error.name,
                            message: error.message,
                        }
                    })
                }
            }


            if (error instanceof Prisma.PrismaClientValidationError) {

                return res.status(401).json({
                    error: {
                        name: error.name,
                        message: error.message,
                    }
                })

            } else {
                return res.status(401).json({ error: { name: 'FindUserByEmailController error: C2DI API', message: String(error) } })
            }



        }
    }
}

export { FindUserByEmailController }