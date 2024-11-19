import { date, number, object, string } from "yup";

const GetInvestmentByIDSchema = object({

    id:string().required("É necessário enviar o id")

})

export {GetInvestmentByIDSchema}