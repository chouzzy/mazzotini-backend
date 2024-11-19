import { Notification } from "@prisma/client"
import { CreateNotificationsRequestProps } from "../useCases/Notifications/createNotifications/createNotificationsController"


interface INotificationsRepository {
    
    createNotifications(notificationsData: CreateNotificationsRequestProps): Promise<Notification>

}

export { INotificationsRepository }