import { ValidationError } from "yup";
import { listUserInvestmentSchema } from "./ListUserInvestmentsSchema";
import { ListUserInvestmentRequestProps } from "./ListUserInvestmentsController";

async function checkQuery(listUserInvestmentData: ListUserInvestmentRequestProps) {

    try {
        await listUserInvestmentSchema.validate(listUserInvestmentData, {
            abortEarly: false
        })
    } catch (error) {
        if (error instanceof ValidationError) {
            return { errorMessage: error.errors, statusCode: 403, isValid: false }
        }
    }

    return { isValid: true, statusCode: 302 }

}
export { checkQuery}