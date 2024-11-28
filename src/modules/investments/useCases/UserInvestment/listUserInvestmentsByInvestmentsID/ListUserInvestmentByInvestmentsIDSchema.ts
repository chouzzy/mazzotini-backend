import { object, string } from "yup";

const listUserInvestmentByInvestmentsIDSchema = object({

    investmentID: string(),

    page: string(),
    pageRange: string()
})

export {listUserInvestmentByInvestmentsIDSchema}