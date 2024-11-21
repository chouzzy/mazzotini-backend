import { ValidationError } from "yup";
import { validationResponse } from "../../../../../types";
import { Investment } from "@prisma/client";
import { InvestmentEntity } from "../../../entities/Investments";
import { deleteInvestmentPartnerSchema } from "./DeleteInvestmentPartnerSchema";




async function checkParam(id: InvestmentEntity["documents"][0]["id"]): Promise<validationResponse> {
    // check body properties
    try {
        await deleteInvestmentPartnerSchema.validate({id}, {
            abortEarly: false,
        })
        return { isValid: true, statusCode: 202 }
    }
    catch (error) {
        throw error
    }
}
export { checkParam }



