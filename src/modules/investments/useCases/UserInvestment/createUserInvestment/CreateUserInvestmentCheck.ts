import { ValidationError } from "yup";
import { validationResponse } from "../../../../../types";
import { CreateInvestmentRequestProps } from "../../Investments/createInvestment/CreateInvestmentController";
import { createInvestmentSchema } from "../../Investments/createInvestment/CreateInvestmentSchema";
import { CreateUserInvestmentRequestProps } from "./CreateUserInvestmentController";
import { createUserInvestmentSchema } from "./CreateUserInvestmentSchema";




async function checkBody(investmentData: CreateUserInvestmentRequestProps): Promise<validationResponse> {
    // check body properties
    try {
        const yupValidation = await createUserInvestmentSchema.validate(investmentData, {
            abortEarly: false,
        })
        return { isValid: true, statusCode: 202 }
    }
    catch (error) {
        if (error instanceof ValidationError) {
            return { errorMessage: error.errors, statusCode: 403, isValid: false }
        }
    }
    return { isValid: true, statusCode: 202 }

}
export { checkBody }



