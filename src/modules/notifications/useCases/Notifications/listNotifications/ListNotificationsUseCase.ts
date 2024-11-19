import { Notification } from "@prisma/client"
import { validationResponse } from "../../../../../types"
import { INotificationsRepository, listNotificationsResponse } from "../../../repositories/INotificationsRepository"
import { ListNotificationsRequestProps } from "./ListNotificationsController"
import { validatePageParams } from "../../../../../utils/notificationsUtils"



class ListNotificationsUseCase {
    constructor(
        private NotificationsRepository: INotificationsRepository) { }

    async execute(id: Notification["investmentId"], page: string, pageRange: string): Promise<listNotificationsResponse> {

        const { pageValid, pageRangeValid } = await validatePageParams({ id, page, pageRange })

        const notifications = await this.NotificationsRepository.listNotifications(id, pageValid, pageRangeValid)

        return notifications
    }

}

export { ListNotificationsUseCase }