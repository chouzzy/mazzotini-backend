import { Investment } from "@prisma/client"
import { validationResponse } from "../../../types"
import { CreateInvestmentRequestProps } from "../useCases/Investments/createInvestment/CreateInvestmentController"
import { ListInvestmentRequestProps } from "../useCases/Investments/listInvestment/ListInvestmentsController"
import { ListInvestmentProps } from "../useCases/Investments/listInvestment/ListInvestmentsUseCase"
import { UpdateInvestmentRequestProps } from "../useCases/Investments/updateInvestment/UpdateInvestmentController"
import { InvestmentEntity } from "../entities/Investments"


interface IInvestmentRepository {

    filterInvestment(listUserInvestmentData: ListInvestmentProps): Promise<Investment[]>

    filterInvestmentByID(id:InvestmentEntity["id"]): Promise<Investment|null>
    
    createInvestment(investmentData: CreateInvestmentRequestProps): Promise<Investment>

    updateInvestment(investmentData: UpdateInvestmentRequestProps, id:InvestmentEntity["id"]): Promise<Investment>
    
    deleteInvestment(id:InvestmentEntity["id"]): Promise<Investment>

}

export { IInvestmentRepository }