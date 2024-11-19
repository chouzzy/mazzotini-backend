import { Notification } from "@prisma/client"
import { INotificationsRepository } from "../INotificationsRepository"
import { prisma } from "../../../../prisma"
import { CreateNotificationsRequestProps } from "../../useCases/Notifications/createNotifications/createNotificationsController"
import { createPrismaNotifications } from "../../../../utils/notificationsUtils"


class NotificationsRepository implements INotificationsRepository {


    async createNotifications(notificationsData: CreateNotificationsRequestProps): Promise<Notification> {
        try {

            const notification = await createPrismaNotifications(notificationsData)

            return notification

        } catch (error) {
            throw error
        }
    }
}

export { NotificationsRepository }