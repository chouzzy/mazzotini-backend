import { Request, Response } from "express"
import { DeleteUsersUseCase } from "./DeleteUsersUseCase"
import { UsersRepository } from "../../../repositories/implementations/UsersRepository"
import { checkBody } from "./DeleteUsersCheck"
import { AxiosError } from "axios"
import { Prisma } from "@prisma/client"
import CryptoJS from 'crypto-js';

class DeleteUsersController {

    async handle(req: Request, res: Response): Promise<Response> {

        try {
            const { id, auth0UserID } = req.body


            if (typeof (id) != 'string') {
                return res.status(401).json({ Error: "ID inválido" })
            }

            if (typeof (auth0UserID) != 'string') {
                return res.status(401).json({ Error: "auth0UserID inválido" })
            }

            if (!auth0UserID) {
                throw Error("auth0UserID ausente.")
            }

            await checkBody(id)

            const userRepository = new UsersRepository()
            const deleteUsersUseCase = new DeleteUsersUseCase(userRepository)
            const deletedMessage = await deleteUsersUseCase.execute(id, auth0UserID)


            return res.status(200).json({
                successMessage: deletedMessage
            })

        } catch (error) {

            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                return res.status(401).json({
                    error: {
                        name: error.name,
                        message: error.message
                    }
                })

            } else if (error instanceof AxiosError) {
                return res.status(401).json({ error })
            }
            else {
                return res.status(401).json({ error: { name: 'DeleteUsersController error: C2DI API', message: String(error) } })
            }

        }

    }
}

export { DeleteUsersController }