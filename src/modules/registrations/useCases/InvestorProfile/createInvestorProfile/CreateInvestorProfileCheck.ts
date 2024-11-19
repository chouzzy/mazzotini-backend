import { CreateInvestorProfileRequestProps } from "./CreateInvestorProfileController";
import { createInvestorProfileSchema } from "./CreateInvestorProfileSchema";




async function checkBody(investorData: CreateInvestorProfileRequestProps) {
    // check body properties
    try {
        await createInvestorProfileSchema.validate(investorData, {
            abortEarly: false,
        })

        return
    }
    catch (error) {
        throw error
    }
}

export { checkBody }



