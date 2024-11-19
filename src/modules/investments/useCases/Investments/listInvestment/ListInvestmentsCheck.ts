import { ValidationError } from "yup";
import { listInvestmentSchema } from "./ListInvestmentsSchema";
import { ListInvestmentRequestProps } from "./ListInvestmentsController";

async function checkQuery(listInvestmentData: ListInvestmentRequestProps) {

    try {
        await listInvestmentSchema.validate(listInvestmentData, {
            abortEarly: false
        })
        return
    } catch (error) {
        throw error
    }


}
export { checkQuery}