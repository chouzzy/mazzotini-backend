import { IInvestmentRepository } from "../../../repositories/IInvestmentRepository"
import { InvestmentEntity } from "../../../entities/Investments"
import { Investment } from "@prisma/client"
//////


class GetInvestmentByIDUseCase {
    constructor(
        private investmentRepository: IInvestmentRepository) { }

    async execute(id: InvestmentEntity["id"]): Promise<Investment|null> {


        const users = await this.investmentRepository.filterInvestmentByID(id)

        return users
    }
}

export { GetInvestmentByIDUseCase }
