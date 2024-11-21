import { Investment } from "@prisma/client"
import { IInvestmentRepository } from "../../../repositories/IInvestmentRepository"
import { InvestmentEntity } from "../../../entities/Investments"



class DeleteInvestmentDocumentUseCase {
    constructor(
        private InvestmentRepository: IInvestmentRepository) {}

    async execute(investmentID:InvestmentEntity["id"] , id: InvestmentEntity["documents"][0]["id"]): Promise<Investment["documents"]> {
        
        const deletedUsers = await this.InvestmentRepository.deleteInvestmentDocument(investmentID, id)
        
        return deletedUsers
    }
    
}

export {DeleteInvestmentDocumentUseCase}