import * as yup from "yup";

const deleteInvestmentSchema = yup.object({
  id: yup.string().required()
}).noUnknown(true, "Campos desconhecidos no corpo da requisição.").strict();

export { deleteInvestmentSchema };