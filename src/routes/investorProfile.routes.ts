import { Router } from "express"
import { checkJwtFromCookie  } from "../modules/registrations/middleware/auth0Check"
import { CreateInvestorProfileController } from "../modules/registrations/useCases/InvestorProfile/createInvestorProfile/CreateInvestorProfileController"

const investorProfileRoutes = Router()   

const createInvestorProfileController = new CreateInvestorProfileController()
investorProfileRoutes.post('/create', checkJwtFromCookie , createInvestorProfileController.handle)


export { investorProfileRoutes }