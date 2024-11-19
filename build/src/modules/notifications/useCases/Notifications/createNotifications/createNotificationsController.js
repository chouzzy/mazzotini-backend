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
exports.CreateNotificationsController = void 0;
const client_1 = require("@prisma/client");
const CreateNotificationsCheck_1 = require("./CreateNotificationsCheck");
const NotificationsRepository_1 = require("../../../repositories/implementations/NotificationsRepository");
const CreateNotificationsUseCase_1 = require("./CreateNotificationsUseCase");
class CreateNotificationsController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const notificationData = req.body;
                yield (0, CreateNotificationsCheck_1.checkBody)(notificationData);
                /// instanciação da classe do caso de uso
                const notificationRepository = new NotificationsRepository_1.NotificationsRepository();
                const createNotificationUseCase = new CreateNotificationsUseCase_1.CreateNotificationsUseCase(notificationRepository);
                const notification = yield createNotificationUseCase.execute(notificationData);
                return res.status(200).json({
                    successMessage: "Notificação criada com sucesso!",
                    notification: notification
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
                    return res.status(401).json({ error: { name: 'CreateNotificationsController error: C2DI API', message: String(error) } });
                }
            }
        });
    }
}
exports.CreateNotificationsController = CreateNotificationsController;
