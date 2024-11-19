import { Investment } from "@prisma/client"
import { IInvestmentRepository } from "../../../repositories/IInvestmentRepository"
import { InvestmentEntity } from "../../../entities/Investments"



class DeleteInvestmentUseCase {
    constructor(
        private InvestmentRepository: IInvestmentRepository) {}

    async execute(id:InvestmentEntity["id"]): Promise<Investment> {
        
        const deletedUsers = await this.InvestmentRepository.deleteInvestment(id)
        
        return deletedUsers
    }
    
}

export {DeleteInvestmentUseCase}