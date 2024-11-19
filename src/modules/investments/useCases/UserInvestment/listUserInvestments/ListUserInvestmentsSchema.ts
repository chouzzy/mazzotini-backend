import { object, string } from "yup";

const listUserInvestmentSchema = object({

    userID: string(),
    investmentID: string(),

    page: string(),
    pageRange: string()
})

export {listUserInvestmentSchema}