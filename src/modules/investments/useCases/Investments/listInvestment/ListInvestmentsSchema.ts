import { date, number, object, string } from "yup";

const listInvestmentSchema = object({

    title: string(),
    description: string(),
    investmentValue: number(),
    companyName: string(),
    finishDateInitial: date(),
    finishDateFinal: date(),
    buildingStatus: string(),
    investmentDateInitial: date(),
    investmentDateFinal: date()

})

export {listInvestmentSchema}