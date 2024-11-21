import * as yup from "yup";

const deleteInvestmentImageSchema = yup.object({
  id: yup.string().required()
}).noUnknown(true, "Campos desconhecidos no corpo da requisição.").strict();

export { deleteInvestmentImageSchema };