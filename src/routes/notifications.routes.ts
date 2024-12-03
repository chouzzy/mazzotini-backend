import { Router } from "express"
import { CreateNotificationsController } from "../modules/notifications/useCases/Notifications/createNotifications/CreateNotificationsController"
import { checkJwtFromCookie } from "../modules/registrations/middleware/auth0Check"
import { ListNotificationsController } from "../modules/notifications/useCases/Notifications/listNotifications/ListNotificationsController"
import { ReadNotificationsController } from "../modules/notifications/useCases/Notifications/readNotifications/ReadNotificationsController"
import { ListUserNotificationsController } from "../modules/notifications/useCases/Notifications/listUserNotifications/ListUserNotificationsController"

const notificationsRoutes = Router()

const createNotificationsController = new CreateNotificationsController()
notificationsRoutes.post('/create', createNotificationsController.handle)

const listNotificationsController = new ListNotificationsController()
notificationsRoutes.get('/list/:id', listNotificationsController.handle)

const listUserNotificationsController = new ListUserNotificationsController()
notificationsRoutes.get('/users/list', listUserNotificationsController.handle)

const readNotificationsController = new ReadNotificationsController()
notificationsRoutes.put('/update/:id', readNotificationsController.handle)


export { notificationsRoutes }