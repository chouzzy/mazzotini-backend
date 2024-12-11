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
exports.ListUserNotificationsUseCase = void 0;
const notificationsUtils_1 = require("../../../../../utils/notificationsUtils");
class ListUserNotificationsUseCase {
    constructor(NotificationsRepository) {
        this.NotificationsRepository = NotificationsRepository;
    }
    execute(userID, page, pageRange) {
        return __awaiter(this, void 0, void 0, function* () {
            const { pageValid, pageRangeValid } = yield (0, notificationsUtils_1.validatePageParams)({ id: userID, page, pageRange });
            const notifications = yield this.NotificationsRepository.listUserNotifications(userID, pageValid, pageRangeValid);
            return notifications;
        });
    }
}
exports.ListUserNotificationsUseCase = ListUserNotificationsUseCase;
