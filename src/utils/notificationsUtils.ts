
import { Notification } from "@prisma/client";
import { CreateNotificationsRequestProps } from "../modules/notifications/useCases/Notifications/createNotifications/CreateNotificationsController";
import { prisma } from "../prisma";
import { ListNotificationsRequestProps } from "../modules/notifications/useCases/Notifications/listNotifications/ListNotificationsController";


async function createPrismaNotifications(notificationsData: CreateNotificationsRequestProps) {

    try {

        console.log('notificationsData')
        console.log(notificationsData)

        const notification = await prisma.notification.create({
            data: notificationsData
        })

        return notification

    } catch (error) {
        throw error
    }
}

async function listPrismaNotifications(id: Notification["investmentId"], page:number, pageRange:number) {

    try {
        const notification = await prisma.notification.findMany({
            where: { investmentId: id },
            skip: (page - 1) * pageRange,
            take: pageRange,
            orderBy: [
                {
                    createdAt: 'desc'
                }
            ]
        })

        const totalDocuments = await prisma.notification.count({
            where: { investmentId: id }
        })

        return {notification, totalDocuments}

    } catch (error) {
        throw error
    }
}

async function readPrismaNotifications(id: Notification["investmentId"]) {

    try {
        const notification = await prisma.notification.update({
            where: { id: id },
            data: {
                isRead: true
            }
        })

        return notification

    } catch (error) {
        throw error
    }
}


async function validatePageParams(listNotificationsData: ListNotificationsRequestProps) {

    try {
        const { page, pageRange } = listNotificationsData;

        const pageInt = Number(page) || 1;
        const pageRangeInt = Number(pageRange) || 10;

        if (!Number.isInteger(pageInt) || pageInt <= 0) {
            throw new Error('Invalid page number');
        }

        if (!Number.isInteger(pageRangeInt) || pageRangeInt <= 0) {
            throw new Error('Invalid page range');
        }

        return {
            pageValid: pageInt,
            pageRangeValid: pageRangeInt,
        };
    } catch (error) {
        throw error;
    }
}

export { createPrismaNotifications, listPrismaNotifications, readPrismaNotifications, validatePageParams }