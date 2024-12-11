"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePageParams = exports.listPrismaUserNotifications = exports.readPrismaNotifications = exports.listPrismaNotifications = exports.createPrismaNotifications = void 0;
const prisma_1 = require("../prisma");
function createPrismaNotifications(notificationsData) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { investmentId } = notificationsData;
            // 1. Verificar se o investmentId existe
            const investment = yield prisma_1.prisma.investment.findUnique({
                where: { id: investmentId },
            });
            if (!investment) {
                throw new Error("Investment não encontrado.");
            }
            const notification = yield prisma_1.prisma.notification.create({
                data: notificationsData
            });
            const usersWithThisInvestment = yield prisma_1.prisma.userInvestment.findMany({
                where: { investmentID: investmentId },
                select: { userID: true } // Seleciona apenas o campo userIDs
            });
            const updatedUsers = yield prisma_1.prisma.users.updateMany({
                where: {
                    id: { in: usersWithThisInvestment.map(user => user.userID) }
                },
                data: {
                    userNotifications: {
                        push: {
                            notificationID: notification.id,
                            isRead: false
                        }
                    }
                }
            });
            return notification;
        }
        catch (error) {
            throw error;
        }
    });
}
exports.createPrismaNotifications = createPrismaNotifications;
function listPrismaUserNotifications(userID, page, pageRange) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const notifications = yield prisma_1.prisma.users.findUnique({
                where: { id: userID },
                select: { userNotifications: true },
            });
            if (!notifications) {
                return { notifications, totalCount: 0 };
            }
            const { userNotifications } = notifications;
            const notificationIDs = userNotifications.map((notification) => notification.notificationID);
            const paginatedUserNotifications = yield prisma_1.prisma.notification.findMany({
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
        }
        catch (error) {
            throw error;
        }
    });
}
exports.listPrismaUserNotifications = listPrismaUserNotifications;
function listPrismaNotifications(id, page, pageRange) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const notification = yield prisma_1.prisma.notification.findMany({
                where: { investmentId: id },
                skip: (page - 1) * pageRange,
                take: pageRange,
                orderBy: [
                    {
                        createdAt: 'desc'
                    }
                ]
            });
            const totalDocuments = yield prisma_1.prisma.notification.count({
                where: { investmentId: id }
            });
            return { notification, totalDocuments };
        }
        catch (error) {
            throw error;
        }
    });
}
exports.listPrismaNotifications = listPrismaNotifications;
function readPrismaNotifications(id) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const notification = yield prisma_1.prisma.notification.update({
                where: { id: id },
                data: {
                    isRead: true
                }
            });
            return notification;
        }
        catch (error) {
            throw error;
        }
    });
}
exports.readPrismaNotifications = readPrismaNotifications;
function validatePageParams(listNotificationsData) {
    return __awaiter(this, void 0, void 0, function* () {
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
        }
        catch (error) {
            throw error;
        }
    });
}
exports.validatePageParams = validatePageParams;
