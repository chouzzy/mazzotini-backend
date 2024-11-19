import { Request, Response } from "express";
import { UsersEntity } from "../../../entities/Users";
import { UsersRepository } from "../../../repositories/implementations/UsersRepository";
import { FindUserByIDUseCase } from "./FindUserByIDUseCase";
import { checkQuery } from "./FindUserByIDCheck";
import { Prisma } from "@prisma/client";


class FindUserByIDController {
    async handle(req: Request, res: Response): Promise<Response> {

        try {

            const {id} = req.params

            console.log('Token aceito!')

            await checkQuery(id)

            if (typeof (id) != 'string') {
                throw Error("Formato do id inválido")
            }

            // Instanciando o useCase no repositório com as funções
            const usersRepository = new UsersRepository()

            const findUserByIDUseCase = new FindUserByIDUseCase(usersRepository);

            const user = await findUserByIDUseCase.execute(id)

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
                return res.status(401).json({ error: { name: 'FindUserByIDController error: C2DI API', message: String(error) } })
            }



        }
    }
}

export { FindUserByIDController }