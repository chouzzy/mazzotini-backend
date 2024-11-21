import { ValidationError } from "yup";
import { validationResponse } from "../../../../../types";
import { Investment } from "@prisma/client";
import { InvestmentEntity } from "../../../entities/Investments";
import { deleteInvestmentDocumentSchema } from "./DeleteInvestmentDocumentSchema";




async function checkParam(id: InvestmentEntity["documents"][0]["id"]): Promise<validationResponse> {
    // check body properties
    try {
        await deleteInvestmentDocumentSchema.validate({id}, {
            abortEarly: false,
        })
        return { isValid: true, statusCode: 202 }
    }
    catch (error) {
        throw error
    }
}
export { checkParam }



