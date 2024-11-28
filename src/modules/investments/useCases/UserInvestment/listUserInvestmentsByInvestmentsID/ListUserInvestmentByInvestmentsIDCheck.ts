import { ValidationError } from "yup";
import { ListUserInvestmentRequestProps } from "./ListUserInvestmentByInvestmentsIDController";
import { listUserInvestmentByInvestmentsIDSchema } from "./ListUserInvestmentByInvestmentsIDSchema";

async function checkQuery(listUserInvestmentData: ListUserInvestmentRequestProps) {

    try {
        await listUserInvestmentByInvestmentsIDSchema.validate(listUserInvestmentData, {
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