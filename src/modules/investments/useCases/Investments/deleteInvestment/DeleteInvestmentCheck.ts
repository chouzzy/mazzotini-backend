import { ValidationError } from "yup";
import { validationResponse } from "../../../../../types";
import { Investment } from "@prisma/client";
import { InvestmentEntity } from "../../../entities/Investments";
import { deleteInvestmentSchema } from "./DeleteInvestmentSchema";




async function checkBody(id: InvestmentEntity["id"]): Promise<validationResponse> {
    // check body properties
    try {
        await deleteInvestmentSchema.validate({id}, {
            abortEarly: false,
        })
        return { isValid: true, statusCode: 202 }
    }
    catch (error) {
        throw error
    }
}
export { checkBody }



