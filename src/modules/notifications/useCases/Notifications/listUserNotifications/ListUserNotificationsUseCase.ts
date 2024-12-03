import { INotificationsRepository, listUserNotificationsResponseProps } from "../../../repositories/INotificationsRepository"
import { validatePageParams } from "../../../../../utils/notificationsUtils"
import { UsersEntity } from "../../../../registrations/entities/Users"



class ListUserNotificationsUseCase {
    constructor(
        private NotificationsRepository: INotificationsRepository) { }

    async execute(userID: UsersEntity["id"], page: string, pageRange: string): Promise<listUserNotificationsResponseProps> {

        const { pageValid, pageRangeValid } = await validatePageParams({ id:userID, page, pageRange })

        const notifications = await this.NotificationsRepository.listUserNotifications(userID, pageValid, pageRangeValid)

        return notifications
    }

}

export { ListUserNotificationsUseCase }