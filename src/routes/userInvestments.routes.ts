import { Router } from "express"
import { ensureAuthenticated } from "../modules/registrations/middleware/ensureAuthenticate"
import { ListUserInvestmentController } from "../modules/investments/useCases/UserInvestment/listUserInvestments/ListUserInvestmentsController"
import { CreateUserInvestmentController } from "../modules/investments/useCases/UserInvestment/createUserInvestment/CreateUserInvestmentController"
import { ListUserInvestmentByInvestmentsIDController } from "../modules/investments/useCases/UserInvestment/listUserInvestmentsByInvestmentsID/ListUserInvestmentByInvestmentsIDController"
import { DeleteUserInvestmentsController } from "../modules/investments/useCases/UserInvestment/deleteUserInvestments/DeleteUserInvestmentsController"
import { checkJwtFromCookie } from "../modules/registrations/middleware/auth0Check"

const userInvestmentsRoutes = Router()

const listUserInvestmentController = new ListUserInvestmentController()
userInvestmentsRoutes.get('/', checkJwtFromCookie, listUserInvestmentController.handle)

const listUserInvestmentByInvestmentsIDController = new ListUserInvestmentByInvestmentsIDController()
userInvestmentsRoutes.get('/byInvestment', checkJwtFromCookie, listUserInvestmentByInvestmentsIDController.handle)

const deleteUserInvestmentController = new DeleteUserInvestmentsController()
userInvestmentsRoutes.delete('/delete/:id', checkJwtFromCookie, deleteUserInvestmentController.handle)

const createUserInvestmentController = new CreateUserInvestmentController()
userInvestmentsRoutes.post('/create', checkJwtFromCookie, createUserInvestmentController.handle)



export { userInvestmentsRoutes }