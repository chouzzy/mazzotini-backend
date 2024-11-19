import { ValidationError } from "yup";
import { validationResponse } from "../../../../../types";
import { UpdateInvestmentRequestProps } from "./UpdateInvestmentController";
import { updateInvestmentSchema } from "./UpdateInvestmentSchema";




async function checkBody(investmentData: UpdateInvestmentRequestProps): Promise<validationResponse> {
    // check body properties
    try {
        await updateInvestmentSchema.validate(investmentData, {
            abortEarly: false,
        })
        return { isValid: true, statusCode: 202 }
    }
    catch (error) {
        throw error
    }
}
export { checkBody }



