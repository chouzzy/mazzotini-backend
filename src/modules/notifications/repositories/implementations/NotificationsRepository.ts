import { Notification, Users } from "@prisma/client"
import { INotificationsRepository, listNotificationsResponse, listUserNotificationsResponseProps } from "../INotificationsRepository"
import { CreateNotificationsRequestProps } from "../../useCases/Notifications/createNotifications/CreateNotificationsController"
import { createPrismaNotifications, listPrismaNotifications, listPrismaUserNotifications, readPrismaNotifications } from "../../../../utils/notificationsUtils"
import { UsersEntity } from "../../../registrations/entities/Users"


class NotificationsRepository implements INotificationsRepository {


    async createNotifications(notificationsData: CreateNotificationsRequestProps): Promise<Notification> {
        try {

            const notification = await createPrismaNotifications(notificationsData)

            return notification

        } catch (error) {
            throw error
        }
    }

    async listNotifications(id: Notification["investmentId"], page: number, pageRange: number): Promise<listNotificationsResponse> {
        try {

            const response = await listPrismaNotifications(id, page, pageRange)

            return response

        } catch (error) {
            throw error
        }
    }


    async listUserNotifications(userID: UsersEntity["id"], page: number, pageRange: number): Promise<listUserNotificationsResponseProps> {
        try {

            const response = await listPrismaUserNotifications(userID, page, pageRange)

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