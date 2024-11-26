import { IUserInvestmentRepository } from "../../../repositories/IUserInvestmentRepository"
import { validationResponse } from "../../../../../types"
import { IInvestmentRepository } from "../../../repositories/IInvestmentRepository"
import { ListInvestmentRequestProps } from "./ListInvestmentsController"
import { InvestmentEntity } from "../../../entities/Investments"
import { validatePageParams } from "../../../../../utils/investmentUtils"
import { Investment } from "@prisma/client"
//////

interface ListInvestmentProps {

    title?: InvestmentEntity["title"];
    investmentValue?: InvestmentEntity["investmentValue"];
    companyName?: InvestmentEntity["companyName"];
    expectedDeliveryDateInitial?: InvestmentEntity["expectedDeliveryDate"];
    expectedDeliveryDateFinal?: InvestmentEntity["expectedDeliveryDate"];
    city?: InvestmentEntity["address"]["city"];
    projectManagerID?:InvestmentEntity["projectManagerID"];
    active?:InvestmentEntity["active"]|string;
    page: number,
    pageRange: number
}

class ListInvestmentUseCase {
    constructor(
        private investmentRepository: IInvestmentRepository) { }

    async execute(listInvestmentData: ListInvestmentRequestProps): Promise<Investment[]> {

        const {
            title,
            investmentValue,
            companyName,
            expectedDeliveryDateInitial,
            expectedDeliveryDateFinal,
            city,
            projectManagerID,
            active
        } = listInvestmentData


        const data = {
            title,
            investmentValue,
            companyName,
            expectedDeliveryDateInitial,
            expectedDeliveryDateFinal,
            city,
            projectManagerID,
            active
        }

        const { page, pageRange } = await validatePageParams(listInvestmentData)


        const listInvestmentFormatted: ListInvestmentProps = {
            ...data,
            page,
            pageRange
        }
        const users = await this.investmentRepository.filterInvestment(listInvestmentFormatted)

        return users
    }
}

export { ListInvestmentUseCase, ListInvestmentProps }
