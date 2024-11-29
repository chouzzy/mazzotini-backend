import { Router } from "express"
import { ListInvestmentsController } from "../modules/investments/useCases/Investments/listInvestment/ListInvestmentsController"
import { CreateInvestmentsController } from "../modules/investments/useCases/Investments/createInvestment/CreateInvestmentController"
import { UpdateInvestmentsController } from "../modules/investments/useCases/Investments/updateInvestment/UpdateInvestmentController"
import { DeleteInvestmentsController } from "../modules/investments/useCases/Investments/deleteInvestment/DeleteInvestmentController"
import { GetInvestmentByIDController } from "../modules/investments/useCases/Investments/getInvestmentByID/GetInvestmentByIDController"
import { DeleteInvestmentImageController } from "../modules/investments/useCases/Investments/deleteInvestmentImage/DeleteInvestmentImageController"
import { DeleteInvestmentDocumentController } from "../modules/investments/useCases/Investments/deleteInvestmentDocument/DeleteInvestmentDocumentController"
import { DeleteInvestmentPartnerController } from "../modules/investments/useCases/Investments/deleteInvestmentPartner/DeleteInvestmentPartnerController"
import { ProjectProgressInvestmentPartnerController } from "../modules/investments/useCases/Investments/investmentProgressImport/InvestmentProgressImportController"
import { checkJwtFromCookie } from "../modules/registrations/middleware/auth0Check"

const investmentsRoutes = Router()

const listInvestmentsController = new ListInvestmentsController()
investmentsRoutes.get('/', checkJwtFromCookie, listInvestmentsController.handle)

const getInvestmentByIDController = new GetInvestmentByIDController()
investmentsRoutes.get('/:id', checkJwtFromCookie, getInvestmentByIDController.handle)

const createInvestmentsController = new CreateInvestmentsController()
investmentsRoutes.post('/create', checkJwtFromCookie, createInvestmentsController.handle)

const updateInvestmentsController = new UpdateInvestmentsController()
investmentsRoutes.put('/update/:id', checkJwtFromCookie, updateInvestmentsController.handle)

const deleteInvestmentsController = new DeleteInvestmentsController()
investmentsRoutes.delete('/delete/:id', checkJwtFromCookie, deleteInvestmentsController.handle)

const deleteInvestmentImageController = new DeleteInvestmentImageController()
investmentsRoutes.put('/delete/image', checkJwtFromCookie, deleteInvestmentImageController.handle)

const deleteInvestmentDocumentController = new DeleteInvestmentDocumentController()
investmentsRoutes.put('/delete/document', checkJwtFromCookie, deleteInvestmentDocumentController.handle)

const deleteInvestmentPartnerController = new DeleteInvestmentPartnerController()
investmentsRoutes.put('/delete/partner', checkJwtFromCookie, deleteInvestmentPartnerController.handle)

// const projectProgressInvestmentPartnerController = new ProjectProgressInvestmentPartnerController()
// investmentsRoutes.post('/progress/import', projectProgressInvestmentPartnerController.handle)


export { investmentsRoutes }
