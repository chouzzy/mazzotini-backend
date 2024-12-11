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
exports.ListUserNotificationsController = void 0;
const client_1 = require("@prisma/client");
// import { checkBody } from "./ListUserNotificationsCheck";
const NotificationsRepository_1 = require("../../../repositories/implementations/NotificationsRepository");
const ListUserNotificationsCheck_1 = require("./ListUserNotificationsCheck");
const ListUserNotificationsUseCase_1 = require("./ListUserNotificationsUseCase");
class ListUserNotificationsController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { userID, page, pageRange } = yield (0, ListUserNotificationsCheck_1.checkParams)(req.query);
                /// instanciação da classe do caso de uso
                const notificationRepository = new NotificationsRepository_1.NotificationsRepository();
                const listUserNotificationUseCase = new ListUserNotificationsUseCase_1.ListUserNotificationsUseCase(notificationRepository);
                const response = yield listUserNotificationUseCase.execute(userID, page, pageRange);
                return res.status(200).json({
                    successMessage: "Notificações listadas com sucesso!",
                    notifications: response.notifications,
                    totalDocuments: response.totalCount
                });
            }
            catch (error) {
                if (error instanceof client_1.Prisma.PrismaClientValidationError) {
                    console.log(error);
                    return res.status(401).json({
                        error: {
                            name: error.name,
                            message: error.message,
                        }
                    });
                }
                else {
                    console.log(error);
                    return res.status(401).json({ error: { name: 'ListUserNotificationsController error: C2DI API', message: String(error) } });
                }
            }
        });
    }
}
exports.ListUserNotificationsController = ListUserNotificationsController;
