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
exports.ReadNotificationsController = void 0;
const client_1 = require("@prisma/client");
const NotificationsRepository_1 = require("../../../repositories/implementations/NotificationsRepository");
const ReadNotificationsCheck_1 = require("./ReadNotificationsCheck");
const ReadNotificationsUseCase_1 = require("./ReadNotificationsUseCase");
class ReadNotificationsController {
    handle(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                console.log(id);
                yield (0, ReadNotificationsCheck_1.checkParams)(id);
                /// instanciação da classe do caso de uso
                const notificationRepository = new NotificationsRepository_1.NotificationsRepository();
                const createNotificationUseCase = new ReadNotificationsUseCase_1.ReadNotificationsUseCase(notificationRepository);
                const notification = yield createNotificationUseCase.execute(id);
                return res.status(200).json({
                    successMessage: "Notificação lida com sucesso!",
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
                    return res.status(401).json({ error: { name: 'ReadNotificationsControllerController error: C2DI API', message: String(error) } });
                }
            }
        });
    }
}
exports.ReadNotificationsController = ReadNotificationsController;
