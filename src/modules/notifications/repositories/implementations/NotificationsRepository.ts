import { Notification } from "@prisma/client"
import { INotificationsRepository, listNotificationsResponse } from "../INotificationsRepository"
import { CreateNotificationsRequestProps } from "../../useCases/Notifications/createNotifications/CreateNotificationsController"
import { createPrismaNotifications, listPrismaNotifications, readPrismaNotifications } from "../../../../utils/notificationsUtils"


class NotificationsRepository implements INotificationsRepository {


    async createNotifications(notificationsData: CreateNotificationsRequestProps): Promise<Notification> {
        try {

            const notification = await createPrismaNotifications(notificationsData)

            return notification

        } catch (error) {
            throw error
        }
    }

    async listNotifications(id: Notification["investmentId"], page:number, pageRange:number): Promise<listNotificationsResponse> {
        try {

            const response = await listPrismaNotifications(id, page, pageRange)

            return response

        } catch (error) {
            throw error
        }
    }

    async readNotification(id: Notification["investmentId"]): Promise<Notification> {
        try {

            const notifications = await readPrismaNotifications(id)

            return notifications

        } catch (error) {
            throw error
        }
    }
}

export { NotificationsRepository }