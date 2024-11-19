import { Notification } from "@prisma/client"
import { INotificationsRepository } from "../../../repositories/INotificationsRepository"



class ReadNotificationsUseCase {
    constructor(
        private NotificationsRepository: INotificationsRepository) {}

    async execute(id: Notification["investmentId"] ): Promise<Notification> {
        
        const notification = await this.NotificationsRepository.readNotification(id)
        
        return notification
    }
    
}

export {ReadNotificationsUseCase}