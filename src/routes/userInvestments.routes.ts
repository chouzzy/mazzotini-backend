import { Router } from "express"
import { ensureAuthenticated } from "../modules/registrations/middleware/ensureAuthenticate"
import { ListUserInvestmentController } from "../modules/investments/useCases/UserInvestment/listUserInvestments/ListUserInvestmentsController"
import { CreateUserInvestmentController } from "../modules/investments/useCases/UserInvestment/createUserInvestment/CreateUserInvestmentController"

const userInvestmentsRoutes = Router()

const listUserInvestmentController = new ListUserInvestmentController()
userInvestmentsRoutes.get('/', listUserInvestmentController.handle)

const createUserInvestmentController = new CreateUserInvestmentController()
userInvestmentsRoutes.post('/create', createUserInvestmentController.handle)



export { userInvestmentsRoutes }