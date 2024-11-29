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

const deleteInvestmentImageController = new DeleteInvestmentImageController()
investmentsRoutes.put('/delete/image', deleteInvestmentImageController.handle)

const deleteInvestmentDocumentController = new DeleteInvestmentDocumentController()
investmentsRoutes.put('/delete/document', deleteInvestmentDocumentController.handle)

const deleteInvestmentPartnerController = new DeleteInvestmentPartnerController()
investmentsRoutes.put('/delete/partner', deleteInvestmentPartnerController.handle)

// const projectProgressInvestmentPartnerController = new ProjectProgressInvestmentPartnerController()
// investmentsRoutes.post('/progress/import', projectProgressInvestmentPartnerController.handle)


export { investmentsRoutes }
