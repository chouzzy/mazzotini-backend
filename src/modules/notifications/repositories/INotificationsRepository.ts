import { Notification } from "@prisma/client"
import { CreateNotificationsRequestProps } from "../useCases/Notifications/createNotifications/CreateNotificationsController"

export interface listNotificationsResponse {
    notification: Notification[],
    totalDocuments:number
}

interface INotificationsRepository {
    
    createNotifications(notificationsData: CreateNotificationsRequestProps): Promise<Notification>
    listNotifications(id: Notification["investmentId"], page: number, pageRange: number): Promise<listNotificationsResponse>
    readNotification(id: Notification["investmentId"]): Promise<Notification>

}

export { INotificationsRepository }