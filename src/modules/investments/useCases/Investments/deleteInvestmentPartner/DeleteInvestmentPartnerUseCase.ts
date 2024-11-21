import { Investment } from "@prisma/client"
import { IInvestmentRepository } from "../../../repositories/IInvestmentRepository"
import { InvestmentEntity } from "../../../entities/Investments"



class DeleteInvestmentPartnerUseCase {
    constructor(
        private InvestmentRepository: IInvestmentRepository) {}

    async execute(investmentID:InvestmentEntity["id"] , id: InvestmentEntity["partners"][0]["id"]): Promise<Investment["partners"]> {
        
        const deletedUsers = await this.InvestmentRepository.deleteInvestmentPartner(investmentID, id)
        
        return deletedUsers
    }
    
}

export {DeleteInvestmentPartnerUseCase}