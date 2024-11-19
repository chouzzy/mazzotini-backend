import { Request, Response } from "express"
import { Prisma } from "@prisma/client"
import { NotificationEntity } from "../../../entities/notifications"
import { NotificationsRepository } from "../../../repositories/implementations/NotificationsRepository";
import { checkParams } from "./ReadNotificationsCheck";
import { ReadNotificationsUseCase } from "./ReadNotificationsUseCase";


interface ReadNotificationsRequestProps {
    id: NotificationEntity["investmentId"];
}

class ReadNotificationsController {
    
    async handle(req: Request, res: Response): Promise<Response> {

        try {

            const {id} = req.params

            console.log(id)

            await checkParams(id)

            /// instanciação da classe do caso de uso
            const notificationRepository = new NotificationsRepository()
            const createNotificationUseCase = new ReadNotificationsUseCase(notificationRepository)
            const notification = await createNotificationUseCase.execute(id)

            return res.status(200).json({
                successMessage: "Notificação lida com sucesso!",
                notification: notification
            })

        } catch (error) {

            if (error instanceof Prisma.PrismaClientValidationError) {

                console.log(error)
                return res.status(401).json({
                    error: {
                        name: error.name,
                        message: error.message,
                    }
                })

            } else {
                console.log(error)
                return res.status(401).json({ error: { name: 'ReadNotificationsControllerController error: C2DI API', message: String(error) } })
            }
        }

    }
}

export { ReadNotificationsController, ReadNotificationsRequestProps }