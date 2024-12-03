import { Notification } from "@prisma/client"
import { CreateNotificationsRequestProps } from "../useCases/Notifications/createNotifications/CreateNotificationsController"
import { UsersEntity } from "../../registrations/entities/Users";

export interface listNotificationsResponse {
    notification: Notification[],
    totalDocuments: number
}

export interface listUserNotificationsResponseProps {
    notifications: Notification[] | null;
    totalCount: number;
}

interface INotificationsRepository {

    createNotifications(notificationsData: CreateNotificationsRequestProps): Promise<Notification>
    listNotifications(id: Notification["investmentId"], page: number, pageRange: number): Promise<listNotificationsResponse>
    readNotification(id: Notification["investmentId"]): Promise<Notification>
    listUserNotifications(userID: UsersEntity["id"], page: number, pageRange: number): Promise<listUserNotificationsResponseProps>

}

export { INotificationsRepository }