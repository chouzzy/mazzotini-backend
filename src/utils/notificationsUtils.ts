import { CreateNotificationsRequestProps } from "../modules/notifications/useCases/Notifications/createNotifications/createNotificationsController";
import { prisma } from "../prisma";


async function createPrismaNotifications(notificationsData: CreateNotificationsRequestProps) {

    try {

        const notification = await prisma.notification.create({
            data: notificationsData
        })

        return notification

    } catch (error) {
        throw error
    }
}

export {createPrismaNotifications}