import * as yup from "yup" ;
import YupPassword from 'yup-password'
YupPassword(yup)

const createUserInvestmentSchema = yup.object({

    userID: yup.string().required("O userID é obrigatório"),
    investmentID: yup.string().required("O investmentID é obrigatório")
})

export { createUserInvestmentSchema }