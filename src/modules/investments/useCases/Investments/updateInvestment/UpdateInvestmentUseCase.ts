import { Investment } from "@prisma/client"
import { IInvestmentRepository } from "../../../repositories/IInvestmentRepository"
import { UpdateInvestmentRequestProps } from "./UpdateInvestmentController"
import { ParamsDictionary } from "express-serve-static-core"
import { InvestmentEntity } from "../../../entities/Investments"



class UpdateInvestmentUseCase {
    constructor(
        private InvestmentRepository: IInvestmentRepository) {}

    async execute(investmentData: UpdateInvestmentRequestProps, id:InvestmentEntity["id"]): Promise<Investment> {
        
        const updatedUsers = await this.InvestmentRepository.updateInvestment(investmentData, id)
        
        return updatedUsers
    }
    
}

export {UpdateInvestmentUseCase}