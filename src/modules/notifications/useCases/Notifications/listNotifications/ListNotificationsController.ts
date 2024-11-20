import { Request, Response } from "express"
import { Prisma } from "@prisma/client"
import { NotificationEntity } from "../../../entities/notifications"
// import { checkBody } from "./ListNotificationsCheck";
import { NotificationsRepository } from "../../../repositories/implementations/NotificationsRepository";
import { checkParams } from "./ListNotificationsCheck";
import { ListNotificationsUseCase } from "./ListNotificationsUseCase";
// import { ListNotificationsUseCase } from "./ListNotificationsUseCase";


interface ListNotificationsRequestProps {
    id: NotificationEntity["investmentId"];
    page?: string;
    pageRange?: string;
}

class ListNotificationsController {

    async handle(req: Request, res: Response): Promise<Response> {

        try {

            const { id } = req.params
            const { page, pageRange } = req.query

            if (typeof page != 'string' || typeof pageRange != 'string') {
                throw Error('page must be a string')
            }

            await checkParams(id)

            /// instanciação da classe do caso de uso
            const notificationRepository = new NotificationsRepository()
            const createNotificationUseCase = new ListNotificationsUseCase(notificationRepository)
            const response = await createNotificationUseCase.execute(id, page, pageRange)

            return res.status(200).json({
                successMessage: "Notificações listadas   com sucesso!",
                notifications: response.notification,
                totalDocuments: response.totalDocuments
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
                return res.status(401).json({ error: { name: 'ListNotificationsController error: C2DI API', message: String(error) } })
            }
        }

    }
}

export { ListNotificationsController, ListNotificationsRequestProps }