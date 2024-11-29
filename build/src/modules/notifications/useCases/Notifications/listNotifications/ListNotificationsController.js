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
exports.ListNotificationsController = void 0;
const client_1 = require("@prisma/client");
// import { checkBody } from "./ListNotificationsCheck";
const NotificationsRepository_1 = require("../../../repositories/implementations/NotificationsRepository");
const ListNotificationsCheck_1 = require("./ListNotificationsCheck");
const ListNotificationsUseCase_1 = require("./ListNotificationsUseCase");
class ListNotificationsController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const { page, pageRange } = req.query;
                if (typeof page != 'string' || typeof pageRange != 'string') {
                    throw Error('page must be a string');
                }
                yield (0, ListNotificationsCheck_1.checkParams)(id);
                /// instanciação da classe do caso de uso
                const notificationRepository = new NotificationsRepository_1.NotificationsRepository();
                const createNotificationUseCase = new ListNotificationsUseCase_1.ListNotificationsUseCase(notificationRepository);
                const response = yield createNotificationUseCase.execute(id, page, pageRange);
                return res.status(200).json({
                    successMessage: "Notificações listadas   com sucesso!",
                    notifications: response.notification,
                    totalDocuments: response.totalDocuments
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
                    return res.status(401).json({ error: { name: 'ListNotificationsController error: C2DI API', message: String(error) } });
                }
            }
        });
    }
}
exports.ListNotificationsController = ListNotificationsController;
