import { Router } from "express"
import { ListInvestmentsController } from "../modules/investments/useCases/Investments/listInvestment/ListInvestmentsController"
import { CreateInvestmentsController } from "../modules/investments/useCases/Investments/createInvestment/CreateInvestmentController"
import { UpdateInvestmentsController } from "../modules/investments/useCases/Investments/updateInvestment/UpdateInvestmentController"
import { DeleteInvestmentsController } from "../modules/investments/useCases/Investments/deleteInvestment/DeleteInvestmentController"
import { GetInvestmentByIDController } from "../modules/investments/useCases/Investments/getInvestmentByID/GetInvestmentByIDController"

const investmentsRoutes = Router()

const listInvestmentsController = new ListInvestmentsController()
investmentsRoutes.get('/', listInvestmentsController.handle)

const getInvestmentByIDController = new GetInvestmentByIDController()
investmentsRoutes.get('/:id', getInvestmentByIDController.handle)

const createInvestmentsController = new CreateInvestmentsController()
investmentsRoutes.post('/create', createInvestmentsController.handle)

const updateInvestmentsController = new UpdateInvestmentsController()
investmentsRoutes.put('/update/:id', updateInvestmentsController.handle)

const deleteInvestmentsController = new DeleteInvestmentsController()
investmentsRoutes.delete('/delete/:id', deleteInvestmentsController.handle)

// Criar rota documents e images




export { investmentsRoutes }