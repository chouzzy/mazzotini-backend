
import { Notification } from "@prisma/client";
import { CreateNotificationsRequestProps } from "../modules/notifications/useCases/Notifications/createNotifications/CreateNotificationsController";
import { prisma } from "../prisma";
import { ListNotificationsRequestProps } from "../modules/notifications/useCases/Notifications/listNotifications/ListNotificationsController";
import { UsersEntity } from "../modules/registrations/entities/Users";


async function createPrismaNotifications(notificationsData: CreateNotificationsRequestProps) {

    try {

        const { investmentId } = notificationsData

        // 1. Verificar se o investmentId existe
        const investment = await prisma.investment.findUnique({
            where: { id: investmentId },
        });
        if (!investment) {
            throw new Error("Investment não encontrado.");
        }

        const notification = await prisma.notification.create({
            data: notificationsData
        })

        const usersWithThisInvestment = await prisma.userInvestment.findMany({
            where: { investmentID: investmentId }, // Filtra pelo investmentID
            select: { userID: true } // Seleciona apenas o campo userIDs
        });

        const updatedUsers = await prisma.users.updateMany({
            where: {
                id: { in: usersWithThisInvestment.map(user => user.userID) }
            },
            data: {
                userNotifications: {
                    push: { // Usa push para adicionar um novo objeto ao array
                        notificationID: notification.id,
                        isRead: false
                    }
                }
            }
        });

        return notification

    } catch (error) {
        throw error
    }
}

async function listPrismaUserNotifications(userID: UsersEntity["id"], page: number, pageRange: number) {

    try {
        const notifications = await prisma.users.findUnique({
            where: { id: userID },
            select: { userNotifications: true },
        })

        if (!notifications) {
            return { notifications, totalCount: 0 }
        }

        const { userNotifications } = notifications

        const notificationIDs = userNotifications.map((notification) => notification.notificationID);

        const paginatedUserNotifications = await prisma.notification.findMany({
            where: {
                id: { in: notificationIDs }, // Filtra pelo notificationID
            },
            skip: (page - 1) * pageRange,
            take: pageRange,
            orderBy: { createdAt: "desc" }, // Ordena por data de criação (opcional)
        });

        return {
            notifications: paginatedUserNotifications,
            totalCount: userNotifications.length,
        };

    } catch (error) {
        throw error
    }
}

async function listPrismaNotifications(id: Notification["investmentId"], page: number, pageRange: number) {

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

        return { notification, totalDocuments }

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

export { createPrismaNotifications, listPrismaNotifications, readPrismaNotifications, listPrismaUserNotifications, validatePageParams }