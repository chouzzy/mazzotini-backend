import { Router } from "express"
import { ensureAuthenticated } from "../modules/registrations/middleware/ensureAuthenticate"
import { ListUserInvestmentController } from "../modules/investments/useCases/UserInvestment/listUserInvestments/ListUserInvestmentsController"
import { CreateUserInvestmentController } from "../modules/investments/useCases/UserInvestment/createUserInvestment/CreateUserInvestmentController"
import { ListUserInvestmentByInvestmentsIDController } from "../modules/investments/useCases/UserInvestment/listUserInvestmentsByInvestmentsID/ListUserInvestmentByInvestmentsIDController"
import { DeleteUserInvestmentsController } from "../modules/investments/useCases/UserInvestment/deleteUserInvestments/DeleteUserInvestmentsController"

const userInvestmentsRoutes = Router()

const listUserInvestmentController = new ListUserInvestmentController()
userInvestmentsRoutes.get('/', listUserInvestmentController.handle)

const listUserInvestmentByInvestmentsIDController = new ListUserInvestmentByInvestmentsIDController()
userInvestmentsRoutes.get('/byInvestment', listUserInvestmentByInvestmentsIDController.handle)

const deleteUserInvestmentController = new DeleteUserInvestmentsController()
userInvestmentsRoutes.delete('/delete/:id', deleteUserInvestmentController.handle)

const createUserInvestmentController = new CreateUserInvestmentController()
userInvestmentsRoutes.post('/create', createUserInvestmentController.handle)



export { userInvestmentsRoutes }