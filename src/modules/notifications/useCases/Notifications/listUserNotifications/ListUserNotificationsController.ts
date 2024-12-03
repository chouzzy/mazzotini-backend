import { Request, Response } from "express"
import { Prisma } from "@prisma/client"
import { NotificationEntity } from "../../../entities/notifications"
// import { checkBody } from "./ListUserNotificationsCheck";
import { NotificationsRepository } from "../../../repositories/implementations/NotificationsRepository";
import { checkParams } from "./ListUserNotificationsCheck";
import { ListUserNotificationsUseCase } from "./ListUserNotificationsUseCase";
import { UsersEntity } from "../../../../registrations/entities/Users";
// import { ListUserNotificationsUseCase } from "./ListUserNotificationsUseCase";


interface ListUserNotificationsRequestProps {
    userID: UsersEntity["id"];
    page: string;
    pageRange: string;
}

class ListUserNotificationsController {

    async handle(req: Request, res: Response): Promise<Response> {

        try {
            const {userID, page, pageRange} = await checkParams(req.query)

            /// instanciação da classe do caso de uso
            const notificationRepository = new NotificationsRepository()
            const listUserNotificationUseCase = new ListUserNotificationsUseCase(notificationRepository)
            const response = await listUserNotificationUseCase.execute(userID, page, pageRange)

            return res.status(200).json({
                successMessage: "Notificações listadas com sucesso!",
                notifications: response.notifications,
                totalDocuments: response.totalCount
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
                return res.status(401).json({ error: { name: 'ListUserNotificationsController error: C2DI API', message: String(error) } })
            }
        }

    }
}

export { ListUserNotificationsController, ListUserNotificationsRequestProps }