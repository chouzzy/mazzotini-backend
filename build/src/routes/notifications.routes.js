"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationsRoutes = void 0;
const express_1 = require("express");
const CreateNotificationsController_1 = require("../modules/notifications/useCases/Notifications/createNotifications/CreateNotificationsController");
const notificationsRoutes = (0, express_1.Router)();
exports.notificationsRoutes = notificationsRoutes;
const createNotificationsController = new CreateNotificationsController_1.CreateNotificationsController();
notificationsRoutes.post('/create', createNotificationsController.handle);
