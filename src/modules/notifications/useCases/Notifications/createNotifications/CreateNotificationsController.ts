import { Request, Response } from "express"
import { Prisma } from "@prisma/client"
import { NotificationEntity } from "../../../entities/notifications"
import { checkBody } from "./CreateNotificationsCheck";
import { NotificationsRepository } from "../../../repositories/implementations/NotificationsRepository";
import { CreateNotificationsUseCase } from "./CreateNotificationsUseCase";


interface CreateNotificationsRequestProps {
    userId: NotificationEntity["userId"];
    investmentId: NotificationEntity["investmentId"];
    title: NotificationEntity["title"];
    message: NotificationEntity["message"];
}

class CreateNotificationsController {
    
    async handle(req: Request, res: Response): Promise<Response> {

        try {

            const notificationData: CreateNotificationsRequestProps = req.body

            await checkBody(notificationData)

            /// instanciação da classe do caso de uso
            const notificationRepository = new NotificationsRepository()
            const createNotificationUseCase = new CreateNotificationsUseCase(notificationRepository)
            const notification = await createNotificationUseCase.execute(notificationData)

            return res.status(200).json({
                successMessage: "Notificação criada com sucesso!",
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
                return res.status(401).json({ error: { name: 'CreateNotificationsController error: C2DI API', message: String(error) } })
            }
        }

    }
}

export { CreateNotificationsController, CreateNotificationsRequestProps }