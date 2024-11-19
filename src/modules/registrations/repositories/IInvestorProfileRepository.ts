import { InvestorProfile } from "@prisma/client"
import { InvestorProfileEntity } from "../../investments/entities/investorProfile"
import { CreateInvestorProfileRequestProps } from "../useCases/InvestorProfile/createInvestorProfile/CreateInvestorProfileController"


interface IInvestorProfileRepository {

    createInvestorProfile(investorProfile:CreateInvestorProfileRequestProps, pesoFinal:Number): Promise<InvestorProfile>

}

export { IInvestorProfileRepository }