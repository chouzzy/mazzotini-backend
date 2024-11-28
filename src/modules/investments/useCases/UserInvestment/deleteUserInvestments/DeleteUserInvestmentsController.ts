import { Request, Response } from "express"
import { DeleteUsersUseCase } from "./DeleteUserInvestmentsUseCase"
import { checkBody } from "./DeleteUserInvestmentsCheck"
import { AxiosError } from "axios"
import { Prisma } from "@prisma/client"
import CryptoJS from 'crypto-js';
import { UserInvestmentRepository } from "../../../repositories/implementations/UserInvestmentRepository"

class DeleteUserInvestmentsController {

    async handle(req: Request, res: Response): Promise<Response> {

        try {
            const {id} = req.params

            if (typeof (id) != 'string') {
                return res.status(401).json({ Error: "ID inválido" })
            }

            await checkBody(id)

            const userRepository = new UserInvestmentRepository()
            const deleteUsersUseCase = new DeleteUsersUseCase(userRepository)
            const userInvestmentDeleted = await deleteUsersUseCase.execute(id)


            return res.status(200).json({
                userInvestmentDeleted: userInvestmentDeleted
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
                return res.status(401).json({ error: { name: 'DeleteUserInvestmentsController error: C2DI API', message: String(error) } })
            }

        }

    }
}

export { DeleteUserInvestmentsController }